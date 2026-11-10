"""Reglas de movimientos: RN-01 (producido único por día), coherencia
tipo↔categoría↔fuente, gastos pagados desde cajita (RN-06) y la restricción
CHECK de la base."""

from datetime import timedelta

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.db import motor
from tests.integracion.conftest import HOY


def _producido(u, id_fuente, monto="85.000", fecha=HOY, **extra):
    return u.post("/api/movimientos/producido", json={
        "id_fuente": id_fuente, "fecha": str(fecha), "monto": monto, "id_categoria_ingreso": u.cat("Producido"), **extra,
    })


def _gasto(u, monto, categoria="Alimentación", **extra):
    return u.post("/api/movimientos", json={"tipo": "GASTO", "fecha": str(HOY), "monto": monto,
                                            "id_categoria": u.cat(categoria), **extra})


# ---------------------------------------------------------------- RN-01 y producido


def test_un_solo_producido_por_fuente_y_dia(ana):
    moto = ana.fuente()
    assert _producido(ana, moto).status_code == 201
    r = _producido(ana, moto, "10.000")
    assert r.status_code == 422
    assert r.json()["errores"] == {"fecha": r.json()["detail"]} and "Ya registraste" in r.json()["detail"]
    # Otro día u otra fuente sí se puede.
    assert _producido(ana, moto, fecha=HOY - timedelta(days=1)).status_code == 201
    assert _producido(ana, ana.fuente("Taxi")).status_code == 201


def test_producido_con_costo_registra_el_gasto_de_la_fuente(ana):
    moto = ana.fuente()
    r = _producido(ana, moto, "$ 120.000", costo="20.000", id_categoria_costo=ana.cat("Combustible"))
    assert r.status_code == 201
    assert r.json()["saldo"]["disponible"] == "100000.00"
    resumen = ana.get("/api/fuentes/resumen").json()[0]
    assert (resumen["bruto"], resumen["costos"], resumen["utilidad"], resumen["dias_trabajados"]) == (
        "120000.00", "20000.00", "100000.00", 1)


def test_producido_con_costo_sin_categoria_no_guarda_nada(ana):
    moto = ana.fuente()
    r = _producido(ana, moto, costo="5.000")
    assert r.status_code == 422 and "id_categoria_costo" in r.json()["errores"]
    assert ana.get("/api/movimientos").json()["total_registros"] == 0  # el ingreso también se revirtió


def test_producido_de_fuente_desactivada_se_rechaza(ana):
    moto = ana.fuente()
    ana.patch(f"/api/fuentes/{moto}/estado", json={"activa": False})
    assert "id_fuente" in _producido(ana, moto).json()["errores"]


# ---------------------------------------------------------------- coherencia


def test_coherencia_tipo_categoria_y_fuente(ana):
    moto = ana.fuente()
    r = ana.post("/api/movimientos", json={"tipo": "INGRESO", "fecha": str(HOY), "monto": "1000",
                                           "id_categoria": ana.cat("Alimentación")})
    assert r.status_code == 422 and "no corresponde" in r.json()["detail"]
    # Un costo operativo exige fuente.
    r = _gasto(ana, "1000", "Combustible")
    assert r.status_code == 422 and "id_fuente" in r.json()["errores"]
    # Un gasto personal nunca queda asociado a una fuente.
    r = _gasto(ana, "1000", id_fuente=moto)
    assert ana.get(f"/api/movimientos/{r.json()['id_movimiento']}").json()["id_fuente"] is None


def test_fecha_futura_y_monto_invalido(ana):
    r = ana.post("/api/movimientos", json={"tipo": "GASTO", "fecha": str(HOY + timedelta(days=1)), "monto": "1000",
                                           "id_categoria": ana.cat("Ocio")})
    assert r.json()["errores"] == {"fecha": "La fecha no puede ser futura."}
    assert "monto" in _gasto(ana, "-500").json()["errores"]
    assert "monto" in _gasto(ana, "abc").json()["errores"]


def test_categoria_desactivada_se_conserva_al_editar(ana):
    id_gasto = _gasto(ana, "1000", "Ocio").json()["id_movimiento"]
    ana.patch(f"/api/categorias/{ana.cat('Ocio')}", json={"activa": False})
    assert "desactivada" in _gasto(ana, "1000", "Ocio").json()["detail"]
    r = ana.put(f"/api/movimientos/{id_gasto}", json={"fecha": str(HOY), "monto": "2000", "id_categoria": ana.cat("Ocio")})
    assert r.status_code == 200 and r.json()["monto"] == "2000.00"


def test_la_base_rechaza_movimientos_incoherentes_aunque_se_salte_la_api(ana):
    caja = ana.cajita(saldo_inicial="1000")
    with pytest.raises(IntegrityError, match="ck_movimiento_coherencia"):
        with motor().begin() as c:
            c.execute(text("""INSERT INTO movimiento (id_usuario, tipo, fecha, monto, id_categoria, id_cajita)
                              VALUES (:u, 'INGRESO', CURRENT_DATE, 10, :cat, :caja)"""),
                      {"u": ana.id, "cat": ana.cat("Salario"), "caja": caja["id"]})
    # Un tipo desconocido viola ck_movimiento_tipo (y también la coherencia, que PostgreSQL puede reportar primero).
    with pytest.raises(IntegrityError, match="ck_movimiento_(tipo|coherencia)"):
        with motor().begin() as c:
            c.execute(text("INSERT INTO movimiento (id_usuario, tipo, fecha, monto, id_categoria) "
                           "VALUES (:u, 'REGALO', CURRENT_DATE, 10, :cat)"), {"u": ana.id, "cat": ana.cat("Salario")})


# ---------------------------------------------------------------- gasto pagado desde una cajita (RN-06)


def test_gasto_desde_cajita_crea_el_retiro_vinculado(ana):
    caja = ana.cajita("Mercado", saldo_inicial="100.000")
    r = _gasto(ana, "30.000", id_cajita_origen=caja["id"])
    assert r.status_code == 201
    id_gasto = r.json()["id_movimiento"]
    assert ana.get(f"/api/cajitas/{caja['id']}").json()["saldo"] == "70000.00"
    # El gasto sale de la cajita, no del disponible: gasto (−) y retiro (+) se compensan.
    assert ana.saldo()["disponible"] == "0.00"

    # El listado no muestra el retiro aparte; el gasto dice de qué cajita se pagó.
    lista = ana.get("/api/movimientos").json()["movimientos"]
    assert [m["tipo"] for m in lista] == ["GASTO", "SALDO_INICIAL"]
    assert lista[0]["nombre_cajita_origen"] == "Mercado"

    # El retiro no se elimina por separado.
    retiro = ana.get(f"/api/cajitas/{caja['id']}/movimientos").json()[0]
    assert retiro["tipo"] == "RETIRO" and not retiro["eliminable"]
    assert ana.delete(f"/api/movimientos/{retiro['id']}").status_code == 422

    # Editar el gasto: el saldo anterior vuelve a contar (70.000 + 30.000).
    editar = {"fecha": str(HOY), "id_categoria": ana.cat("Alimentación")}
    assert ana.put(f"/api/movimientos/{id_gasto}", json={**editar, "monto": "100.001"}).status_code == 422
    assert ana.put(f"/api/movimientos/{id_gasto}", json={**editar, "monto": "100.000"}).status_code == 200
    assert ana.get(f"/api/cajitas/{caja['id']}").json()["saldo"] == "0.00"

    # Eliminar el gasto elimina el retiro (ON DELETE CASCADE) y devuelve el dinero a la cajita.
    assert ana.delete(f"/api/movimientos/{id_gasto}").status_code == 200
    assert ana.get(f"/api/cajitas/{caja['id']}").json()["saldo"] == "100000.00"


def test_gasto_desde_cajita_sin_saldo_suficiente(ana):
    caja = ana.cajita("Mercado", saldo_inicial="10.000")
    r = _gasto(ana, "10.001", id_cajita_origen=caja["id"])
    assert r.status_code == 422 and r.json()["detail"] == "Mercado solo tiene $ 10.000."
    assert ana.get("/api/movimientos", params={"tipo": "GASTO"}).json()["total_registros"] == 0


def test_no_se_elimina_un_aporte_si_la_cajita_quedaria_en_negativo(ana):
    ana.ingreso("50.000")
    caja = ana.cajita("Viaje")
    aporte = ana.post(f"/api/cajitas/{caja['id']}/operaciones",
                      json={"operacion": "APORTE", "fecha": str(HOY), "monto": "50.000"}).json()["id_movimiento"]
    ana.post(f"/api/cajitas/{caja['id']}/operaciones", json={"operacion": "RETIRO", "fecha": str(HOY), "monto": "20.000"})
    r = ana.delete(f"/api/movimientos/{aporte}")
    assert r.status_code == 422 and "negativo" in r.json()["detail"]
    # Las operaciones de cajita no se editan.
    assert ana.put(f"/api/movimientos/{aporte}", json={"fecha": str(HOY), "monto": "1"}).status_code == 422


# ---------------------------------------------------------------- listado


def test_listado_filtra_pagina_y_por_defecto_muestra_el_mes_actual(ana):
    for i in range(35):
        _gasto(ana, str(1000 + i))
    ana.ingreso("5000", fecha=HOY.replace(day=1) - timedelta(days=1))  # mes anterior: no aparece
    p0 = ana.get("/api/movimientos").json()
    assert (p0["total_registros"], len(p0["movimientos"]), p0["hay_siguiente"]) == (35, 30, True)
    p1 = ana.get("/api/movimientos", params={"pagina": 1}).json()
    assert (len(p1["movimientos"]), p1["hay_anterior"], p1["hay_siguiente"]) == (5, True, False)
    assert ana.get("/api/movimientos", params={"tipo": "INGRESO"}).json()["total_registros"] == 0
    todo = ana.get("/api/movimientos", params={"desde": "2026-01-01", "hasta": str(HOY)}).json()
    assert todo["total_registros"] == 36 and todo["total_ingresos"] == "5000.00"
