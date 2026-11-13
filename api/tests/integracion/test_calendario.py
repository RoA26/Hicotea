"""Calendario vivo (C-01, C-03, C-06). HOY = 2026-11-10 (martes)."""

from datetime import date, timedelta

from tests.integracion.conftest import HOY

AYER = HOY - timedelta(days=1)


def _dias(u, mes="2026-11") -> dict:
    c = u.get("/api/calendario", params={"mes": mes}).json()
    return {d["fecha"]: d for s in c["semanas"] for d in s}


def _op(u, id_cajita, operacion, monto, fecha=HOY):
    r = u.post(f"/api/cajitas/{id_cajita}/operaciones",
               json={"operacion": operacion, "fecha": str(fecha), "monto": monto})
    assert r.status_code == 201, r.text


def test_estados_del_dia_coexisten_y_el_ahorro_va_aparte(ana):
    ana.ingreso("100000", fecha=date(2026, 11, 3))
    caja = ana.cajita("Viaje")
    _op(ana, caja["id"], "APORTE", "30000", date(2026, 11, 3))
    _op(ana, caja["id"], "RETIRO", "5000", date(2026, 11, 3))
    ana.post("/api/movimientos", json={"tipo": "GASTO", "fecha": "2026-11-03", "monto": "2000",
                                       "id_categoria": ana.cat("Alimentación"), "id_cajita_origen": caja["id"]})
    d = _dias(ana)["2026-11-03"]
    # El gasto pagado desde la cajita es un gasto real; su retiro enlazado no es una "operación de ahorro".
    assert (d["ingresos"], d["gastos"]) == ("100000.00", "2000.00")
    assert (d["aportes"], d["retiros"], d["operaciones_ahorro"]) == ("30000.00", "5000.00", 2)
    assert d["registros"] == 4 and d["sin_registros"] is False


def test_dias_sin_registros_solo_desde_el_comienzo_del_historial_y_nunca_futuros(ana):
    ana.ingreso("1000", fecha=date(2026, 11, 5))
    dias = _dias(ana)
    assert dias["2026-11-04"]["sin_registros"] is False  # antes del primer movimiento
    assert dias["2026-11-05"]["sin_registros"] is False  # tiene registro
    assert dias["2026-11-06"]["sin_registros"] is True
    assert dias[str(AYER)]["sin_registros"] is True
    assert dias[str(HOY)]["sin_registros"] is False and dias[str(HOY)]["hoy"] is True  # hoy aún puede registrar
    manana = dias[str(HOY + timedelta(days=1))]
    assert manana["futuro"] is True and manana["sin_registros"] is False


def test_usuario_sin_historial_no_tiene_dias_olvidados(ana):
    assert not any(d["sin_registros"] for d in _dias(ana).values())


def test_compromisos_previstos_aparecen_en_su_dia(ana):
    r = ana.post("/api/recurrentes", json={"nombre": "Arriendo", "tipo": "GASTO", "monto": "800000",
                                            "id_categoria": ana.cat("Arriendo"), "periodicidad": "MENSUAL",
                                            "proxima_fecha": "2026-11-28"})
    assert r.status_code == 201, r.text
    d = _dias(ana)["2026-11-28"]
    assert d["futuro"] is True
    assert [(c["nombre"], c["tipo"], c["monto"]) for c in d["compromisos"]] == [("Arriendo", "GASTO", "800000.00")]


def test_el_calendario_solo_muestra_datos_del_usuario(ana, beto):
    beto.ingreso("50000", fecha=AYER)
    d = _dias(ana)[str(AYER)]
    assert d["ingresos"] == "0.00" and d["registros"] == 0


def test_registro_retrospectivo_respeta_la_fecha_efectiva(ana):
    """C-03: la API guarda la fecha enviada; el mes anterior queda en su mes."""
    ana.ingreso("70000", fecha=date(2026, 10, 15))
    octubre = _dias(ana, "2026-10")["2026-10-15"]
    assert octubre["ingresos"] == "70000.00"
    assert _dias(ana)[str(HOY)]["ingresos"] == "0.00"
    r = ana.post("/api/movimientos", json={"tipo": "INGRESO", "fecha": str(HOY + timedelta(days=1)),
                                           "monto": "1", "id_categoria": ana.cat("Salario")})
    assert r.status_code == 422 and "futura" in r.json()["errores"]["fecha"]


def test_atajo_usado_en_una_fecha_pasada(ana):
    r = ana.post("/api/atajos", json={"nombre": "Almuerzo", "tipo": "GASTO", "monto": "15000",
                                       "id_categoria": ana.cat("Alimentación")})
    assert r.status_code == 201, r.text
    id_atajo = r.json()["id"]
    r = ana.post(f"/api/atajos/{id_atajo}/usar", json={"fecha": str(AYER)})
    assert r.status_code == 200, r.text
    m = ana.get(f"/api/movimientos/{r.json()['id_movimiento']}").json()
    assert m["fecha"] == str(AYER)
    # Sin cuerpo sigue siendo hoy; en el futuro, no.
    r = ana.post(f"/api/atajos/{id_atajo}/usar")
    assert ana.get(f"/api/movimientos/{r.json()['id_movimiento']}").json()["fecha"] == str(HOY)
    assert ana.post(f"/api/atajos/{id_atajo}/usar", json={"fecha": str(HOY + timedelta(days=1))}).status_code == 422


def test_atajo_retrospectivo_respeta_rn01(ana):
    moto = ana.fuente("Motocarro")
    r = ana.post("/api/atajos", json={"nombre": "Día normal", "tipo": "INGRESO", "monto": "90000",
                                       "id_categoria": ana.cat("Producido"), "id_fuente": moto})
    id_atajo = r.json()["id"]
    assert ana.post(f"/api/atajos/{id_atajo}/usar", json={"fecha": str(AYER)}).status_code == 200
    r = ana.post(f"/api/atajos/{id_atajo}/usar", json={"fecha": str(AYER)})
    assert r.status_code == 422 and "producido" in r.json()["detail"]
