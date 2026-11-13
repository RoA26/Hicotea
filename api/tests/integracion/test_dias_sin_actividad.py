"""C-04 / C-05: días confirmados sin actividad y recordatorio de ayer. HOY = 2026-11-10."""

from datetime import date, timedelta

from tests.integracion.conftest import HOY

AYER = HOY - timedelta(days=1)


def _dia(u, fecha):
    c = u.get("/api/calendario", params={"mes": str(fecha)[:7]}).json()
    return next(d for s in c["semanas"] for d in s if d["fecha"] == str(fecha))


def test_confirmar_es_idempotente_no_mueve_dinero_y_se_deshace(ana):
    ana.ingreso("50000", fecha=date(2026, 11, 1))
    antes = ana.saldo()
    movs = ana.get("/api/movimientos").json()["total_registros"]
    for _ in range(2):
        r = ana.put(f"/api/dias-sin-actividad/{AYER}")
        assert r.status_code == 200 and r.json() == {"fecha": str(AYER), "confirmado": True}
    d = _dia(ana, AYER)
    assert d["sin_actividad"] is True and d["sin_registros"] is False
    assert ana.saldo() == antes and ana.get("/api/movimientos").json()["total_registros"] == movs
    assert ana.delete(f"/api/dias-sin-actividad/{AYER}").json()["confirmado"] is False
    assert ana.delete(f"/api/dias-sin-actividad/{AYER}").status_code == 200  # idempotente
    d = _dia(ana, AYER)
    assert d["sin_actividad"] is False and d["sin_registros"] is True


def test_reglas_de_confirmacion(ana):
    assert ana.put(f"/api/dias-sin-actividad/{AYER}").status_code == 422  # sin historial
    ana.ingreso("1000", fecha=date(2026, 11, 3))
    assert ana.put("/api/dias-sin-actividad/2026-11-02").status_code == 422  # antes del historial
    assert ana.put(f"/api/dias-sin-actividad/{HOY + timedelta(days=1)}").status_code == 422  # futuro
    r = ana.put("/api/dias-sin-actividad/2026-11-03")
    assert r.status_code == 422 and "ya tiene movimientos" in r.json()["detail"]


def test_un_movimiento_posterior_tiene_prioridad(ana):
    ana.ingreso("1000", fecha=date(2026, 11, 1))
    ana.put(f"/api/dias-sin-actividad/{AYER}")
    id_mov = ana.ingreso("2000", fecha=AYER)
    d = _dia(ana, AYER)
    assert d["sin_actividad"] is False and d["registros"] == 1
    # Si se elimina el movimiento, la confirmación vuelve a contar (la fila no se perdió).
    ana.delete(f"/api/movimientos/{id_mov}")
    assert _dia(ana, AYER)["sin_actividad"] is True


def test_es_por_usuario(ana, beto):
    ana.ingreso("1000", fecha=date(2026, 11, 1))
    beto.ingreso("1000", fecha=date(2026, 11, 1))
    ana.put(f"/api/dias-sin-actividad/{AYER}")
    assert _dia(beto, AYER)["sin_actividad"] is False


def test_recordatorio_de_ayer(ana):
    assert ana.get("/api/tablero").json()["ayer_sin_registros"] is False  # sin historial
    ana.ingreso("1000", fecha=date(2026, 11, 1))
    assert ana.get("/api/tablero").json()["ayer_sin_registros"] is True
    ana.put(f"/api/dias-sin-actividad/{AYER}")
    assert ana.get("/api/tablero").json()["ayer_sin_registros"] is False
    ana.delete(f"/api/dias-sin-actividad/{AYER}")
    ana.ingreso("500", fecha=AYER)
    assert ana.get("/api/tablero").json()["ayer_sin_registros"] is False
