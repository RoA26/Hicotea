"""Recurrentes, atajos, tablero, calendario, aislamiento entre usuarios y
acceso compartido de solo lectura."""

from datetime import date

from sqlalchemy import text

from app.db import motor
from tests.integracion.conftest import HOY, Usuario


# ---------------------------------------------------------------- recurrentes


def test_confirmar_un_recurrente_registra_el_movimiento_y_avanza_con_dia_ancla(ana, hoy):
    hoy(date(2027, 1, 29))
    r = ana.post("/api/recurrentes", json={
        "nombre": "Arriendo", "tipo": "GASTO", "monto": "800.000", "id_categoria": ana.cat("Arriendo"),
        "periodicidad": "MENSUAL", "proxima_fecha": "2027-01-31", "dias_aviso": 3,
    })
    assert r.status_code == 201, r.text
    rec = r.json()
    assert rec["dia_ancla"] == 31 and rec["pendiente"]
    assert [p["nombre"] for p in ana.get("/api/recurrentes/pendientes").json()] == ["Arriendo"]

    # Aún no llega la fecha: se registra con fecha de hoy y salta a febrero (28).
    r = ana.post(f"/api/recurrentes/{rec['id']}/confirmar", json={"ocurrencia": "2027-01-31", "monto": "820.000"})
    assert r.status_code == 200, r.text
    mov = ana.get(f"/api/movimientos/{r.json()['id_movimiento']}").json()
    assert (mov["fecha"], mov["monto"], mov["descripcion"]) == ("2027-01-29", "820000.00", "Arriendo")
    assert ana.get(f"/api/recurrentes/{rec['id']}").json()["proxima_fecha"] == "2027-02-28"

    # Ya vencido: se registra en su fecha y vuelve al 31 en marzo.
    hoy(date(2027, 3, 2))
    r = ana.post(f"/api/recurrentes/{rec['id']}/confirmar", json={"ocurrencia": "2027-02-28"})
    assert ana.get(f"/api/movimientos/{r.json()['id_movimiento']}").json()["fecha"] == "2027-02-28"
    assert ana.get(f"/api/recurrentes/{rec['id']}").json()["proxima_fecha"] == "2027-03-31"

    # Omitir avanza sin registrar.
    antes = ana.get("/api/movimientos", params={"desde": "2027-01-01", "hasta": "2027-12-31"}).json()["total_registros"]
    assert ana.post(f"/api/recurrentes/{rec['id']}/omitir", json={"ocurrencia": "2027-03-31"}).json()["proxima_fecha"] == "2027-04-30"
    assert ana.get("/api/movimientos", params={"desde": "2027-01-01", "hasta": "2027-12-31"}).json()["total_registros"] == antes


def test_si_el_registro_falla_la_fecha_del_recurrente_no_avanza(ana):
    caja = ana.cajita("Servicios", saldo_inicial="10.000")
    rec = ana.post("/api/recurrentes", json={
        "nombre": "Luz", "tipo": "GASTO", "monto": "50.000", "id_categoria": ana.cat("Servicios públicos"),
        "id_cajita_origen": caja["id"], "periodicidad": "MENSUAL", "proxima_fecha": str(HOY),
    }).json()
    r = ana.post(f"/api/recurrentes/{rec['id']}/confirmar", json={"ocurrencia": str(HOY)})
    assert r.status_code == 422 and "solo tiene" in r.json()["detail"]
    assert ana.get(f"/api/recurrentes/{rec['id']}").json()["proxima_fecha"] == str(HOY)
    # Pausado no se confirma.
    ana.patch(f"/api/recurrentes/{rec['id']}/estado", json={"activa": False})
    assert "pausado" in ana.post(f"/api/recurrentes/{rec['id']}/confirmar", json={"ocurrencia": str(HOY)}).json()["detail"]


# ---------------------------------------------------------------- atajos


def test_atajo_registra_con_un_toque_y_se_deshace(ana):
    r = ana.post("/api/atajos", json={"nombre": "Almuerzo", "tipo": "GASTO", "monto": "15.000",
                                       "id_categoria": ana.cat("Alimentación")})
    assert r.status_code == 201
    atajo = r.json()
    ana.ingreso("100.000")

    r = ana.post(f"/api/atajos/{atajo['id']}/usar")
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["mensaje"] == "Almuerzo · − $ 15.000"
    assert cuerpo["saldo"]["disponible"] == "85000.00"
    mov = ana.get(f"/api/movimientos/{cuerpo['id_movimiento']}").json()
    assert (mov["fecha"], mov["descripcion"]) == (str(HOY), "Almuerzo")

    # "Deshacer"
    assert ana.delete(f"/api/movimientos/{cuerpo['id_movimiento']}").json()["saldo"]["disponible"] == "100000.00"


def test_atajos_nombre_unico_y_maximo_doce(ana):
    base = {"tipo": "GASTO", "monto": "1000", "id_categoria": ana.cat("Ocio")}
    for i in range(12):
        assert ana.post("/api/atajos", json={**base, "nombre": f"B{i}"}).status_code == 201
    assert "hasta 12" in ana.post("/api/atajos", json={**base, "nombre": "B12"}).json()["detail"]
    ana.delete(f"/api/atajos/{ana.get('/api/atajos').json()[0]['id']}")
    assert "nombre" in ana.post("/api/atajos", json={**base, "nombre": "b5"}).json()["errores"]


# ---------------------------------------------------------------- tablero y calendario


def test_tablero_resume_el_mes(ana):
    moto = ana.fuente()
    ana.post("/api/movimientos/producido", json={"id_fuente": moto, "fecha": str(HOY), "monto": "90.000",
                                                 "id_categoria_ingreso": ana.cat("Producido"),
                                                 "costo": "10.000", "id_categoria_costo": ana.cat("Combustible")})
    ana.post("/api/movimientos", json={"tipo": "GASTO", "fecha": str(HOY), "monto": "5.000", "id_categoria": ana.cat("Ocio")})
    ana.cajita("Ahorro", saldo_inicial="20.000")
    t = ana.get("/api/tablero").json()
    assert t["mes"] == "2026-11" and t["hoy"] == str(HOY)
    assert t["mes_actual"] == {"ingresos": "90000.00", "gastos_personales": "5000.00", "costos_operativos": "10000.00",
                               "gastos_totales": "15000.00", "balance": "75000.00"}
    assert (t["disponible"], t["total_cajitas"], t["saldo_total"]) == ("75000.00", "20000.00", "95000.00")
    assert [m["mes"] for m in t["graficas"]["por_mes"]] == ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"]
    assert len(t["graficas"]["producido_por_dia"]) == 10 and t["graficas"]["producido_por_dia"][-1]["total"] == "90000.00"
    assert len(t["ultimos_movimientos"]) == 4 and not t["sin_movimientos"]


def test_calendario_marca_los_dias_sin_producido_de_una_fuente_diaria(ana):
    moto = ana.fuente()
    with motor().begin() as c:  # la fuente existe desde el 1 de noviembre
        c.execute(text("UPDATE fuente_ingreso SET fecha_creacion = '2026-11-01 08:00-05' WHERE id = :id"), {"id": moto})
    for dia in (3, 4):
        ana.post("/api/movimientos/producido", json={"id_fuente": moto, "fecha": f"2026-11-0{dia}", "monto": "50000",
                                                     "id_categoria_ingreso": ana.cat("Producido")})
    cal = ana.get("/api/calendario", params={"mes": "2026-11"}).json()
    assert (cal["mes_anterior"], cal["mes_siguiente"]) == ("2026-10", "2026-12")
    assert all(len(s) == 7 for s in cal["semanas"]) and cal["semanas"][0][0]["fecha"] == "2026-10-26"  # lunes
    # Del 1 al 9 (hoy es 10): 9 días, 2 con producido.
    assert (cal["dias_con_producido"], cal["dias_sin_producido"]) == (2, 7)
    assert cal["total_ingresos"] == "100000.00"


# ---------------------------------------------------------------- aislamiento entre usuarios


def test_nadie_ve_ni_toca_los_datos_de_otro(ana, beto):
    id_mov = ana.ingreso("10.000")
    caja = ana.cajita("Secreta", saldo_inicial="5.000")
    moto = ana.fuente()

    assert beto.get(f"/api/movimientos/{id_mov}").status_code == 404
    assert beto.put(f"/api/movimientos/{id_mov}", json={"fecha": str(HOY), "monto": "1", "id_categoria": beto.cat("Salario")}).status_code == 404
    assert beto.delete(f"/api/movimientos/{id_mov}").status_code == 404
    assert beto.get(f"/api/cajitas/{caja['id']}").status_code == 404
    assert beto.post(f"/api/cajitas/{caja['id']}/operaciones", json={"operacion": "RETIRO", "fecha": str(HOY), "monto": "1"}).status_code == 404
    assert beto.patch(f"/api/categorias/{ana.cat('Ocio')}", json={"nombre": "Hackeado"}).status_code == 404
    # Tampoco puede usar categorías, fuentes ni cajitas ajenas en sus propios movimientos.
    r = beto.post("/api/movimientos", json={"tipo": "INGRESO", "fecha": str(HOY), "monto": "1", "id_categoria": ana.cat("Salario")})
    assert r.json()["errores"] == {"id_categoria": "Esa categoría no existe."}
    r = beto.post("/api/movimientos", json={"tipo": "GASTO", "fecha": str(HOY), "monto": "1",
                                            "id_categoria": beto.cat("Combustible"), "id_fuente": moto})
    assert "id_fuente" in r.json()["errores"]
    r = beto.post("/api/movimientos", json={"tipo": "GASTO", "fecha": str(HOY), "monto": "1",
                                            "id_categoria": beto.cat("Ocio"), "id_cajita_origen": caja["id"]})
    assert "id_cajita_origen" in r.json()["errores"]
    assert beto.get("/api/movimientos").json()["total_registros"] == 0
    assert ana.get(f"/api/cajitas/{caja['id']}").json()["saldo"] == "5000.00"


# ---------------------------------------------------------------- acceso compartido


def test_acceso_compartido_de_solo_lectura(ana, beto):
    ana.ingreso("10.000")
    assert beto.get(f"/api/compartido/{ana.id}/tablero").status_code == 404

    r = ana.post("/api/compartir", json={"nombre_usuario": "BETO"})
    assert r.status_code == 201 and r.json()[0]["nombre_usuario_invitado"] == "beto"
    assert "ya puede" in ana.post("/api/compartir", json={"nombre_usuario": "beto"}).json()["detail"]
    assert "propio" in ana.post("/api/compartir", json={"nombre_usuario": "ana"}).json()["detail"]
    assert ana.post("/api/compartir", json={"nombre_usuario": "nadie"}).status_code == 422

    assert [a["nombre_completo_titular"] for a in beto.get("/api/compartir/recibidos").json()] == ["Ana Prueba"]
    assert beto.get(f"/api/compartido/{ana.id}/tablero").json()["disponible"] == "10000.00"
    assert beto.get(f"/api/compartido/{ana.id}/movimientos").json()["total_registros"] == 1
    assert beto.get(f"/api/compartido/{ana.id}/calendario").status_code == 200
    # Solo lectura: no hay rutas de escritura sobre la cuenta compartida.
    assert beto.post(f"/api/compartido/{ana.id}/movimientos", json={}).status_code == 405
    # Compartir no es recíproco, y un tercero no ve nada.
    assert ana.get(f"/api/compartido/{beto.id}/tablero").status_code == 404
    carla = Usuario("carla")
    assert carla.get(f"/api/compartido/{ana.id}/tablero").status_code == 404

    acceso = ana.get("/api/compartir").json()[0]["id"]
    assert beto.delete(f"/api/compartir/{acceso}").status_code == 404  # solo el titular revoca
    assert ana.delete(f"/api/compartir/{acceso}").status_code == 204
    assert beto.get(f"/api/compartido/{ana.id}/tablero").status_code == 404
