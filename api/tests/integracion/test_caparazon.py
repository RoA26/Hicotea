"""Caparazón: cajita + meta en una transacción, reconocimiento de logros, historial."""

from datetime import date

from tests.integracion.conftest import HOY


def _op(u, id_cajita, operacion, monto, fecha=HOY):
    r = u.post(f"/api/cajitas/{id_cajita}/operaciones",
               json={"operacion": operacion, "fecha": str(fecha), "monto": monto})
    assert r.status_code == 201, r.text


def test_crear_cajita_con_descripcion_y_meta(ana):
    r = ana.post("/api/cajitas", json={"nombre": "Moto", "descripcion": " Para la moto nueva ", "proposito": "COMPRAS",
                                        "porcentaje": "10", "meta": {"monto_objetivo": "2.000.000"}})
    assert r.status_code == 201, r.text
    caja = r.json()
    assert caja["descripcion"] == "Para la moto nueva"
    metas = ana.get("/api/metas").json()
    assert [(m["nombre"], m["id_cajita"], m["monto_objetivo"]) for m in metas] == [("Moto", caja["id"], "2000000.00")]


def test_si_la_meta_falla_no_queda_la_cajita_creada(ana):
    caja = ana.cajita("Otra")
    ana.post("/api/metas", json={"nombre": "Viaje", "monto_objetivo": "100", "id_cajita": caja["id"]})
    r = ana.post("/api/cajitas", json={"nombre": "Viaje", "proposito": "LIBRE",
                                        "meta": {"nombre": "Viaje", "monto_objetivo": "500"}})
    assert r.status_code == 422
    assert "meta_nombre" in r.json()["errores"] and "No se creó la cajita" in r.json()["detail"]
    assert [c["nombre"] for c in ana.get("/api/cajitas").json()] == ["Otra"]


def test_meta_vacia_se_ignora(ana):
    r = ana.post("/api/cajitas", json={"nombre": "Libre", "proposito": "LIBRE", "meta": {"monto_objetivo": ""}})
    assert r.status_code == 201 and ana.get("/api/metas").json() == []


def test_reconocer_logro_guarda_fechas_distintas_y_no_mueve_dinero(ana, hoy):
    ana.ingreso("300000", fecha=date(2026, 11, 1))
    caja = ana.cajita("Viaje")
    _op(ana, caja["id"], "APORTE", "60000", date(2026, 11, 2))
    _op(ana, caja["id"], "APORTE", "60000", date(2026, 11, 5))  # aquí llega a 120.000 ≥ 100.000
    _op(ana, caja["id"], "RETIRO", "30000", date(2026, 11, 6))
    m = ana.post("/api/metas", json={"nombre": "Cartagena", "monto_objetivo": "80000", "id_cajita": caja["id"]}).json()
    antes = ana.saldo()
    movs_antes = ana.get("/api/movimientos").json()["total_registros"]

    r = ana.post(f"/api/metas/{m['id']}/logro")
    assert r.status_code == 200, r.text
    logro = r.json()
    # Alcanzada: primera fecha con saldo acumulado ≥ 80.000 (el 5); reconocida: hoy.
    assert (logro["alcanzada_en"], logro["cumplida_en"]) == ("2026-11-05", str(HOY))
    assert logro["activa"] is False and logro["cumplida"] is True and logro["monto_logrado"] == "80000.00"
    assert ana.saldo() == antes
    assert ana.get("/api/movimientos").json()["total_registros"] == movs_antes
    assert ana.get(f"/api/cajitas/{caja['id']}").json()["saldo"] == "90000.00"


def test_no_se_reconoce_un_logro_sin_cumplir_ni_dos_veces(ana):
    caja = ana.cajita("Viaje", saldo_inicial="10000")
    m = ana.post("/api/metas", json={"nombre": "Cartagena", "monto_objetivo": "50000", "id_cajita": caja["id"]}).json()
    r = ana.post(f"/api/metas/{m['id']}/logro")
    assert r.status_code == 422 and "faltan" in r.json()["detail"]
    caja2 = ana.cajita("Moto", saldo_inicial="50000")
    m2 = ana.post("/api/metas", json={"nombre": "Moto", "monto_objetivo": "50000", "id_cajita": caja2["id"]}).json()
    assert ana.post(f"/api/metas/{m2['id']}/logro").status_code == 200
    assert ana.post(f"/api/metas/{m2['id']}/logro").status_code == 422


def test_historial_de_ahorro_incluye_cajitas_archivadas_y_solo_del_usuario(ana, beto):
    ana.ingreso("50000")
    caja = ana.cajita("Viaje")
    _op(ana, caja["id"], "APORTE", "20000")
    _op(ana, caja["id"], "RETIRO", "20000")
    ana.patch(f"/api/cajitas/{caja['id']}/estado", json={"activa": False})
    beto.cajita("Suya", saldo_inicial="999")
    h = ana.get("/api/cajitas/historial").json()
    assert sorted(m["tipo"] for m in h) == ["APORTE", "RETIRO"]
    assert all(m["nombre_cajita"] == "Viaje" for m in h)
