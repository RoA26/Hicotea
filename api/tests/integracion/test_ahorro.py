"""Cajitas (porcentajes RN-05, resto único, reparto RN-03/04), metas y presupuestos."""

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.db import motor
from tests.integracion.conftest import HOY


def _operacion(u, id_cajita, operacion, monto):
    return u.post(f"/api/cajitas/{id_cajita}/operaciones",
                  json={"operacion": operacion, "fecha": str(HOY), "monto": monto})


def test_los_porcentajes_de_las_cajitas_no_pasan_de_cien(ana):
    a = ana.cajita("A", "60")
    r = ana.post("/api/cajitas", json={"nombre": "B", "proposito": "LIBRE", "porcentaje": "50"})
    assert r.status_code == 422 and "110%" in r.json()["detail"]
    ana.cajita("B", "40")
    # Al editar se excluye su propio porcentaje anterior.
    assert ana.put(f"/api/cajitas/{a['id']}", json={"nombre": "A", "proposito": "LIBRE", "porcentaje": "60"}).status_code == 200
    # Reactivar una cajita también valida la suma.
    ana.patch(f"/api/cajitas/{a['id']}/estado", json={"activa": False})
    ana.cajita("C", "60")
    assert ana.patch(f"/api/cajitas/{a['id']}/estado", json={"activa": True}).status_code == 422


def test_solo_una_cajita_resto(ana):
    a = ana.cajita("A", es_resto=True)
    b = ana.cajita("B", es_resto=True)
    cajitas = {c["id"]: c for c in ana.get("/api/cajitas").json()}
    assert not cajitas[a["id"]]["es_resto"] and cajitas[b["id"]]["es_resto"]


def test_nombre_de_cajita_unico_sin_importar_mayusculas(ana):
    ana.cajita("Viaje")
    r = ana.post("/api/cajitas", json={"nombre": "VIAJE", "proposito": "LIBRE"})
    assert r.status_code == 422 and "nombre" in r.json()["errores"]


def test_aporte_no_supera_el_disponible_y_retiro_no_supera_el_saldo(ana):
    ana.ingreso("50.000")
    caja = ana.cajita("Viaje")
    r = _operacion(ana, caja["id"], "APORTE", "50.001")
    assert r.status_code == 422 and "Saldo que ya tenía" in r.json()["detail"]
    assert _operacion(ana, caja["id"], "APORTE", "50.000").json()["saldo"]["disponible"] == "0.00"
    assert _operacion(ana, caja["id"], "RETIRO", "50.001").status_code == 422
    assert _operacion(ana, caja["id"], "RENDIMIENTO", "1.000").status_code == 201
    assert ana.get(f"/api/cajitas/{caja['id']}").json()["saldo"] == "51000.00"
    assert _operacion(ana, caja["id"], "INGRESO", "1").status_code == 422


def test_no_se_desactiva_una_cajita_con_saldo(ana):
    caja = ana.cajita("Viaje", saldo_inicial="1.000")
    r = ana.patch(f"/api/cajitas/{caja['id']}/estado", json={"activa": False})
    assert r.status_code == 422 and "$ 1.000" in r.json()["detail"]


def test_reparto_sugerido_y_confirmado(ana):
    ana.ingreso("100.001")
    ids = {
        "Daniela": ana.cajita("Daniela", "50")["id"],
        "Atenea": ana.cajita("Atenea", "33.33")["id"],
        "Emergencia": ana.cajita("Emergencia", "10")["id"],
        "Chelas": ana.cajita("Chelas", es_resto=True)["id"],
    }
    p = ana.get("/api/cajitas/reparto").json()
    assert p["monto_a_repartir"] == "100001.00" and p["sobrante"] == "0.00"
    assert {l["nombre"]: l["monto"] for l in p["lineas"]} == {
        "Daniela": "50000.00", "Atenea": "33330.00", "Emergencia": "10000.00", "Chelas": "6671.00"}
    assert p["suma_porcentajes"] == "93.33" and p["porcentajes_incompletos"]

    r = ana.post("/api/cajitas/reparto", json={"lineas": [{"id_cajita": l["id_cajita"], "monto": l["monto"]} for l in p["lineas"]]})
    assert r.status_code == 200 and r.json()["total"] == "100001.00"
    assert ana.saldo()["disponible"] == "0.00"
    assert ana.get(f"/api/cajitas/{ids['Chelas']}").json()["saldo"] == "6671.00"


def test_reparto_es_todo_o_nada(ana):
    ana.ingreso("10.000")
    a, b = ana.cajita("A")["id"], ana.cajita("B")["id"]
    r = ana.post("/api/cajitas/reparto", json={"lineas": [{"id_cajita": a, "monto": "6.000"}, {"id_cajita": b, "monto": "6.000"}]})
    assert r.status_code == 422 and "$ 12.000" in r.json()["detail"]
    r = ana.post("/api/cajitas/reparto", json={"lineas": [{"id_cajita": a, "monto": "1.000"}, {"id_cajita": b, "monto": "12.345,678"}]})
    assert r.status_code == 422 and r.json()["detail"].startswith("Revisa el monto de B")
    assert ana.saldo()["disponible"] == "10000.00"  # ningún aporte quedó guardado
    assert ana.post("/api/cajitas/reparto", json={"lineas": [{"id_cajita": a, "monto": "0"}]}).status_code == 422
    assert ana.get("/api/cajitas/reparto", params={"monto": "20.000"}).status_code == 422


def test_meta_toma_el_progreso_del_saldo_de_su_cajita(ana):
    caja = ana.cajita("Moto nueva", saldo_inicial="500.000")
    r = ana.post("/api/metas", json={"nombre": "Moto", "monto_objetivo": "1.500.000",
                                      "fecha_objetivo": "2027-02-10", "id_cajita": caja["id"]})
    assert r.status_code == 201
    m = r.json()
    assert (m["porcentaje"], m["faltante"], m["meses_restantes"], m["aporte_mensual"]) == (33, "1000000.00", 3, "333334.00")
    r = ana.post("/api/metas", json={"nombre": "Otra", "monto_objetivo": "1", "fecha_objetivo": str(HOY), "id_cajita": caja["id"]})
    assert "fecha_objetivo" in r.json()["errores"]
    # Eliminar la meta no toca el dinero.
    assert ana.delete(f"/api/metas/{m['id']}").status_code == 204
    assert ana.get(f"/api/cajitas/{caja['id']}").json()["saldo"] == "500000.00"


def test_presupuesto_alerta_desde_el_ochenta_por_ciento(ana):
    r = ana.put("/api/presupuestos", json={"id_categoria": ana.cat("Alimentación"), "monto": "100.000"})
    assert r.status_code == 200
    ana.post("/api/movimientos", json={"tipo": "GASTO", "fecha": str(HOY), "monto": "80.000", "id_categoria": ana.cat("Alimentación")})
    p = ana.get("/api/presupuestos").json()
    assert p["mes"] == "2026-11" and p["presupuestos"][0]["porcentaje"] == 80 and p["presupuestos"][0]["en_alerta"]
    assert [a["categoria"] for a in ana.get("/api/tablero").json()["alertas_presupuesto"]] == ["Alimentación"]
    # Guardar de nuevo reemplaza el monto (no duplica).
    p = ana.put("/api/presupuestos", json={"id_categoria": ana.cat("Alimentación"), "monto": "200.000"}).json()
    assert len(p["presupuestos"]) == 1 and not p["presupuestos"][0]["en_alerta"]
    # No hay presupuestos de ingresos.
    assert ana.put("/api/presupuestos", json={"id_categoria": ana.cat("Salario"), "monto": "1"}).status_code == 422


# ------------------------------------------------------------------ Caparazón: una meta activa por cajita


def _meta(u, nombre, id_cajita, objetivo="100000"):
    return u.post("/api/metas", json={"nombre": nombre, "monto_objetivo": objetivo, "id_cajita": id_cajita})


def test_una_cajita_admite_una_sola_meta_activa(ana):
    """H-03: antes, dos metas sobre la misma cajita contaban el mismo saldo."""
    caja = ana.cajita("Viaje", saldo_inicial="100000")
    otra = ana.cajita("Moto")
    a = _meta(ana, "Cartagena", caja["id"]).json()
    r = _meta(ana, "Bogotá", caja["id"])
    assert r.status_code == 422 and "Cartagena" in r.json()["errores"]["id_cajita"]
    # Tampoco al cambiar la cajita de otra meta activa ni al reactivar.
    b = _meta(ana, "Bogotá", otra["id"]).json()
    r = ana.put(f"/api/metas/{b['id']}", json={"nombre": "Bogotá", "monto_objetivo": "100000", "id_cajita": caja["id"]})
    assert r.status_code == 422
    ana.patch(f"/api/metas/{a['id']}/estado", json={"activa": False})
    assert ana.put(f"/api/metas/{b['id']}", json={"nombre": "Bogotá", "monto_objetivo": "100000",
                                                   "id_cajita": caja["id"]}).status_code == 200
    assert ana.patch(f"/api/metas/{a['id']}/estado", json={"activa": True}).status_code == 422


def test_el_indice_unico_respalda_la_regla(ana):
    caja = ana.cajita("Viaje")
    _meta(ana, "Cartagena", caja["id"])
    with motor().begin() as c:
        try:
            c.execute(text("INSERT INTO meta (id_usuario, nombre, monto_objetivo, id_cajita) "
                           "VALUES (:u, 'Directa', 1, :c)"), {"u": ana.id, "c": caja["id"]})
        except IntegrityError as e:
            assert "uq_meta_activa_por_cajita" in str(e)
        else:
            raise AssertionError("el índice no impidió una segunda meta activa")


def test_una_meta_cumplida_archivada_conserva_su_logro(ana):
    caja = ana.cajita("Viaje", saldo_inicial="120000")
    m = _meta(ana, "Cartagena", caja["id"]).json()
    assert m["cumplida"] is True
    r = ana.patch(f"/api/metas/{m['id']}/estado", json={"activa": False}).json()
    assert (r["cumplida_en"], r["monto_logrado"]) == (str(HOY), "100000.00")
    # Se retira el dinero (se usó para el viaje): el logro histórico sigue.
    ana.post(f"/api/cajitas/{caja['id']}/operaciones",
             json={"operacion": "RETIRO", "fecha": str(HOY), "monto": "120000"})
    r = ana.get(f"/api/metas/{m['id']}").json()
    assert r["cumplida"] is True and r["porcentaje"] == 100
    # La cajita queda libre para una meta nueva.
    assert _meta(ana, "Santa Marta", caja["id"]).status_code == 201


def test_archivar_una_meta_no_cumplida_no_inventa_logro(ana):
    caja = ana.cajita("Viaje", saldo_inicial="10000")
    m = _meta(ana, "Cartagena", caja["id"]).json()
    r = ana.patch(f"/api/metas/{m['id']}/estado", json={"activa": False}).json()
    assert r["cumplida_en"] is None and r["cumplida"] is False
