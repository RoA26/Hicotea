"""Integridad de recurrentes: una confirmación u omisión se refiere a una
ocurrencia concreta (`ocurrencia` = la `proxima_fecha` que vio el usuario).
Si la fecha ya avanzó (doble toque, reintento, otra pestaña, edición), la API
responde 409 RECURRENTE_AVANZO y no registra nada."""

from datetime import date

from app.db import motor
from app.errores import ReglaNegocio
from app.esquemas.entradas import ConfirmacionRecurrenteForm
from app.servicios import recurrentes
from tests.integracion.conftest import HOY
from tests.integracion.test_concurrencia import _carrera

PERIODO = {"desde": "2026-01-01", "hasta": "2027-12-31"}


def _arriendo(u, proxima=HOY) -> dict:
    r = u.post("/api/recurrentes", json={
        "nombre": "Arriendo", "tipo": "GASTO", "monto": "800.000", "id_categoria": u.cat("Arriendo"),
        "periodicidad": "MENSUAL", "proxima_fecha": str(proxima), "dias_aviso": 3,
    })
    assert r.status_code == 201, r.text
    return r.json()


def _movimientos(u) -> int:
    return u.get("/api/movimientos", params=PERIODO).json()["total_registros"]


def test_confirmacion_valida_registra_una_vez_y_avanza(ana):
    rec = _arriendo(ana)
    r = ana.post(f"/api/recurrentes/{rec['id']}/confirmar", json={"ocurrencia": str(HOY)})
    assert r.status_code == 200, r.text
    assert _movimientos(ana) == 1
    assert ana.get(f"/api/recurrentes/{rec['id']}").json()["proxima_fecha"] == "2026-12-10"


def test_confirmar_dos_veces_la_misma_ocurrencia_no_duplica(ana):
    rec = _arriendo(ana)
    assert ana.post(f"/api/recurrentes/{rec['id']}/confirmar", json={"ocurrencia": str(HOY)}).status_code == 200
    r = ana.post(f"/api/recurrentes/{rec['id']}/confirmar", json={"ocurrencia": str(HOY)})
    assert r.status_code == 409, r.text
    cuerpo = r.json()
    assert cuerpo["codigo"] == "RECURRENTE_AVANZO"
    assert cuerpo["datos"]["proxima_fecha"] == "2026-12-10"
    assert "10/12/2026" in cuerpo["detail"]
    # Ni un segundo movimiento ni otro salto de fecha.
    assert _movimientos(ana) == 1
    assert ana.get(f"/api/recurrentes/{rec['id']}").json()["proxima_fecha"] == "2026-12-10"


def test_confirmar_despues_de_omitir_la_misma_ocurrencia_se_rechaza(ana):
    rec = _arriendo(ana)
    assert ana.post(f"/api/recurrentes/{rec['id']}/omitir", json={"ocurrencia": str(HOY)}).status_code == 200
    r = ana.post(f"/api/recurrentes/{rec['id']}/confirmar", json={"ocurrencia": str(HOY)})
    assert r.status_code == 409 and r.json()["codigo"] == "RECURRENTE_AVANZO"
    assert _movimientos(ana) == 0


def test_omitir_una_ocurrencia_obsoleta_no_salta_otro_periodo(ana):
    rec = _arriendo(ana)
    assert ana.post(f"/api/recurrentes/{rec['id']}/confirmar", json={"ocurrencia": str(HOY)}).status_code == 200
    r = ana.post(f"/api/recurrentes/{rec['id']}/omitir", json={"ocurrencia": str(HOY)})
    assert r.status_code == 409 and r.json()["codigo"] == "RECURRENTE_AVANZO"
    assert ana.get(f"/api/recurrentes/{rec['id']}").json()["proxima_fecha"] == "2026-12-10"


def test_editar_la_fecha_invalida_la_confirmacion_de_la_fecha_vieja(ana):
    rec = _arriendo(ana)
    cuerpo = {k: rec[k] for k in ("nombre", "tipo", "id_categoria", "periodicidad", "dias_aviso")}
    r = ana.put(f"/api/recurrentes/{rec['id']}", json={**cuerpo, "monto": "800000", "proxima_fecha": "2026-11-20"})
    assert r.status_code == 200, r.text
    r = ana.post(f"/api/recurrentes/{rec['id']}/confirmar", json={"ocurrencia": str(HOY)})
    assert r.status_code == 409 and r.json()["datos"]["proxima_fecha"] == "2026-11-20"
    assert _movimientos(ana) == 0


def test_la_ocurrencia_es_obligatoria(ana):
    rec = _arriendo(ana)
    r = ana.post(f"/api/recurrentes/{rec['id']}/confirmar", json={})
    assert r.status_code == 422 and "ocurrencia" in r.json()["errores"]
    r = ana.post(f"/api/recurrentes/{rec['id']}/omitir")
    assert r.status_code == 422
    assert _movimientos(ana) == 0


def test_otro_usuario_no_puede_confirmar_ni_omitir(ana):
    from tests.integracion.conftest import Usuario

    rec = _arriendo(ana)
    beto = Usuario("beto")
    assert beto.post(f"/api/recurrentes/{rec['id']}/confirmar", json={"ocurrencia": str(HOY)}).status_code == 404
    assert beto.post(f"/api/recurrentes/{rec['id']}/omitir", json={"ocurrencia": str(HOY)}).status_code == 404
    assert ana.get(f"/api/recurrentes/{rec['id']}").json()["proxima_fecha"] == str(HOY)


def test_dos_confirmaciones_simultaneas_de_la_misma_ocurrencia_solo_una_registra(ana):
    """La segunda espera el candado del usuario; al entrar ve la fecha avanzada
    y responde RECURRENTE_AVANZO en vez de confirmar el periodo siguiente."""
    rec = _arriendo(ana)
    id_usuario = ana.id
    conf = ConfirmacionRecurrenteForm(ocurrencia=HOY)

    resultado = _carrera(
        lambda con: recurrentes.confirmar(con, id_usuario, rec["id"], conf),
        lambda con: recurrentes.confirmar(con, id_usuario, rec["id"], conf),
    )
    assert isinstance(resultado.get("error"), ReglaNegocio)
    assert resultado["error"].codigo == "RECURRENTE_AVANZO"
    assert _movimientos(ana) == 1
    assert ana.get(f"/api/recurrentes/{rec['id']}").json()["proxima_fecha"] == "2026-12-10"


def test_el_avance_es_condicional_aunque_falle_el_candado(ana):
    """Defensa en profundidad: si la fila cambió entre la lectura y el UPDATE,
    el avance no se aplica y el movimiento se revierte con la transacción."""
    rec = _arriendo(ana)
    id_usuario = ana.id
    from app.repos import otros as repo

    with motor().connect() as con:
        assert repo.recurrente_avanzar_si(con, id_usuario, rec["id"], date(2026, 11, 9), date(2026, 12, 9)) is False
        assert repo.recurrente_avanzar_si(con, id_usuario, rec["id"], HOY, date(2026, 12, 10)) is True
        con.rollback()
