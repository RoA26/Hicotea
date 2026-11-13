"""Integridad financiera (D-F1, D-F2, D-F4). Ver docs/decisiones-foundations.md."""

from datetime import timedelta

from sqlalchemy import text

from app.db import motor
from tests.integracion.conftest import HOY


def _op(u, id_cajita, operacion, monto):
    r = u.post(f"/api/cajitas/{id_cajita}/operaciones",
               json={"operacion": operacion, "fecha": str(HOY), "monto": monto})
    assert r.status_code == 201, r.text
    return r.json()["id_movimiento"]


def _gasto(u, monto, **extra):
    r = u.post("/api/movimientos", json={"tipo": "GASTO", "fecha": str(HOY), "monto": monto,
                                         "id_categoria": u.cat("Alimentación"), **extra})
    assert r.status_code == 201, r.text
    return r.json()["id_movimiento"]


def _desactivar(u, id_cajita):
    r = u.patch(f"/api/cajitas/{id_cajita}/estado", json={"activa": False})
    assert r.status_code == 200, r.text


# ------------------------------------------------------------------ D-F1


def test_no_se_elimina_el_retiro_que_vacio_una_cajita_desactivada(ana):
    """H-01: antes, el total bajaba de 100.000 a 60.000 y 40.000 quedaban escondidos."""
    ana.ingreso("100000")
    caja = ana.cajita("Viaje")
    _op(ana, caja["id"], "APORTE", "40000")
    id_retiro = _op(ana, caja["id"], "RETIRO", "40000")
    _desactivar(ana, caja["id"])

    r = ana.delete(f"/api/movimientos/{id_retiro}")
    assert r.status_code == 422 and "Viaje está desactivada" in r.json()["detail"]
    assert ana.saldo()["total"] == "100000.00"
    assert ana.get(f"/api/cajitas/{caja['id']}").json()["saldo"] == "0.00"

    # Reactivada, la eliminación vuelve a estar permitida y el dinero se ve.
    assert ana.patch(f"/api/cajitas/{caja['id']}/estado", json={"activa": True}).status_code == 200
    assert ana.delete(f"/api/movimientos/{id_retiro}").status_code == 200
    s = ana.saldo()
    assert (s["disponible"], s["en_cajitas"], s["total"]) == ("60000.00", "40000.00", "100000.00")


def test_no_se_elimina_un_gasto_pagado_desde_una_cajita_desactivada(ana):
    caja = ana.cajita("Mercado", saldo_inicial="30000")
    id_gasto = _gasto(ana, "30000", id_cajita_origen=caja["id"])
    _desactivar(ana, caja["id"])
    r = ana.delete(f"/api/movimientos/{id_gasto}")
    assert r.status_code == 422 and "Mercado está desactivada" in r.json()["detail"]
    assert ana.get(f"/api/cajitas/{caja['id']}").json()["saldo"] == "0.00"


def test_no_se_cambia_el_monto_de_un_gasto_pagado_desde_una_cajita_desactivada(ana):
    caja = ana.cajita("Mercado", saldo_inicial="30000")
    id_gasto = _gasto(ana, "30000", id_cajita_origen=caja["id"])
    _desactivar(ana, caja["id"])
    base = {"tipo": "GASTO", "fecha": str(HOY), "id_categoria": ana.cat("Alimentación")}
    r = ana.put(f"/api/movimientos/{id_gasto}", json={**base, "monto": "10000"})
    assert r.status_code == 422 and "desactivada" in r.json()["detail"]
    # Corregir datos que no mueven dinero sí se permite.
    r = ana.put(f"/api/movimientos/{id_gasto}", json={**base, "monto": "30000", "descripcion": "Plaza"})
    assert r.status_code == 200 and r.json()["descripcion"] == "Plaza"


def test_tampoco_se_elimina_un_aporte_de_una_cajita_desactivada(ana):
    ana.ingreso("10000")
    caja = ana.cajita("Viaje")
    id_aporte = _op(ana, caja["id"], "APORTE", "10000")
    _op(ana, caja["id"], "RETIRO", "10000")
    _desactivar(ana, caja["id"])
    assert ana.delete(f"/api/movimientos/{id_aporte}").status_code == 422


def test_el_total_cuenta_el_dinero_de_cajitas_inactivas_y_lo_avisa(ana):
    """Segunda protección: si una cajita inactiva tiene saldo (datos anteriores a
    D-F1), el total lo incluye y la API lo informa. No se toca ningún registro."""
    caja = ana.cajita("Vieja", saldo_inicial="25000")
    with motor().begin() as c:  # simula una inconsistencia histórica
        c.execute(text("UPDATE cajita SET activa = FALSE WHERE id = :id"), {"id": caja["id"]})
    s = ana.saldo()
    assert (s["en_cajitas"], s["total"]) == ("25000.00", "25000.00")
    assert s["cajitas_inactivas_con_saldo"] == [{"id": caja["id"], "nombre": "Vieja", "saldo": "25000.00"}]
    t = ana.get("/api/tablero").json()
    assert t["total_cajitas"] == "25000.00" and t["saldo_total"] == "25000.00"
    assert [c["id"] for c in t["cajitas_inactivas_con_saldo"]] == [caja["id"]]
    assert all(c["activa"] for c in t["cajitas"])  # la lista del tablero sigue siendo de activas


# ------------------------------------------------------------------ D-F2


def test_eliminar_un_ingreso_repartido_pide_confirmacion_y_no_compensa(ana):
    id_ingreso = ana.ingreso("100000")
    caja = ana.cajita("Viaje")
    _op(ana, caja["id"], "APORTE", "70000")

    r = ana.delete(f"/api/movimientos/{id_ingreso}")
    assert r.status_code == 409
    cuerpo = r.json()
    assert cuerpo["codigo"] == "DISPONIBLE_NEGATIVO"
    assert cuerpo["datos"] == {"disponible_actual": "30000.00", "disponible_resultante": "-70000.00",
                               "faltante": "70000.00"}
    assert ana.saldo()["disponible"] == "30000.00"  # no se borró nada

    r = ana.delete(f"/api/movimientos/{id_ingreso}", params={"confirmar_negativo": "true"})
    assert r.status_code == 200
    s = r.json()["saldo"]
    assert (s["disponible"], s["en_cajitas"], s["total"]) == ("-70000.00", "70000.00", "0.00")
    # Ningún movimiento compensatorio: solo queda el aporte.
    movs = ana.get("/api/movimientos").json()["movimientos"]
    assert [m["tipo"] for m in movs] == ["APORTE"]


def test_rebajar_un_ingreso_repartido_pide_confirmacion(ana):
    id_ingreso = ana.ingreso("100000")
    caja = ana.cajita("Viaje")
    _op(ana, caja["id"], "APORTE", "100000")
    datos = {"tipo": "INGRESO", "fecha": str(HOY), "monto": "60000", "id_categoria": ana.cat("Salario")}
    r = ana.put(f"/api/movimientos/{id_ingreso}", json=datos)
    assert r.status_code == 409 and r.json()["datos"]["faltante"] == "40000.00"
    r = ana.put(f"/api/movimientos/{id_ingreso}", json=datos, params={"confirmar_negativo": True})
    assert r.status_code == 200 and ana.saldo()["disponible"] == "-40000.00"


def test_eliminar_un_retiro_ya_gastado_pide_confirmacion(ana):
    caja = ana.cajita("Viaje", saldo_inicial="50000")
    id_retiro = _op(ana, caja["id"], "RETIRO", "50000")
    _gasto(ana, "50000")
    assert ana.delete(f"/api/movimientos/{id_retiro}").status_code == 409


def test_las_correcciones_que_no_dejan_negativo_no_piden_confirmacion(ana):
    id_ingreso = ana.ingreso("100000")
    caja = ana.cajita("Viaje")
    _op(ana, caja["id"], "APORTE", "30000")
    assert ana.delete(f"/api/movimientos/{id_ingreso}").status_code == 409  # 70.000 − 100.000 < 0
    otro = ana.ingreso("50000")
    assert ana.delete(f"/api/movimientos/{otro}").status_code == 200  # 120.000 − 50.000 ≥ 0


def test_aportes_y_repartos_siguen_exigiendo_fondos_con_disponible_negativo(ana):
    id_ingreso = ana.ingreso("100000")
    caja = ana.cajita("Viaje")
    _op(ana, caja["id"], "APORTE", "100000")
    ana.delete(f"/api/movimientos/{id_ingreso}", params={"confirmar_negativo": True})
    r = ana.post(f"/api/cajitas/{caja['id']}/operaciones",
                 json={"operacion": "APORTE", "fecha": str(HOY), "monto": "1"})
    assert r.status_code == 422
    r = ana.post("/api/cajitas/reparto", json={"lineas": [{"id_cajita": caja["id"], "monto": "1"}]})
    assert r.status_code == 422


def test_los_gastos_ordinarios_no_cambian_de_regla(ana):
    """Un gasto normal sigue registrándose aunque deje el disponible negativo (regla previa)."""
    _gasto(ana, "5000")
    assert ana.saldo()["disponible"] == "-5000.00"


# ------------------------------------------------------------------ D-F4


def test_una_fuente_desactivada_sigue_en_el_desglose_de_los_meses_que_produjo(ana):
    moto = ana.fuente("Motocarro")
    ana.post("/api/movimientos/producido", json={"id_fuente": moto, "fecha": str(HOY), "monto": "80000",
                                                  "id_categoria_ingreso": ana.cat("Producido")})
    ana.fuente("Taxi")  # activa, sin movimientos: sigue apareciendo como antes
    assert ana.patch(f"/api/fuentes/{moto}/estado", json={"activa": False}).status_code == 200

    fuentes = {f["nombre"]: f for f in ana.get("/api/tablero").json()["fuentes"]}
    assert fuentes["Motocarro"]["bruto"] == "80000.00" and fuentes["Motocarro"]["activa"] is False
    assert fuentes["Taxi"]["activa"] is True

    # En un mes en que no produjo, la fuente inactiva no aparece.
    mes_siguiente = (HOY.replace(day=1) + timedelta(days=32)).replace(day=1)
    r = ana.get("/api/fuentes/resumen", params={"desde": str(mes_siguiente), "hasta": str(mes_siguiente)})
    assert [f["nombre"] for f in r.json()] == ["Taxi"]


def test_categorias_homonimas_no_se_mezclan_en_gastos_por_categoria(ana):
    moto = ana.fuente("Motocarro")
    r = ana.post("/api/categorias", json={"nombre": "Alimentación", "tipo": "COSTO_OPERATIVO"})
    assert r.status_code == 201, r.text
    costo = r.json()["id"]
    _gasto(ana, "10000")
    ana.post("/api/movimientos", json={"tipo": "GASTO", "fecha": str(HOY), "monto": "4000",
                                       "id_categoria": costo, "id_fuente": moto})
    datos = ana.get("/api/tablero").json()["graficas"]["gastos_por_categoria"]
    assert sorted((d["categoria"], d["tipo"], d["total"]) for d in datos) == [
        ("Alimentación", "COSTO_OPERATIVO", "4000.00"),
        ("Alimentación", "GASTO", "10000.00"),
    ]
