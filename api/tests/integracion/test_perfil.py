"""Perfil (/api/cuenta): datos, verificación de correo, contraseña y sesiones."""

import logging
import secrets

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app import correo
from app.db import motor
from app.main import app
from tests.integracion.conftest import Usuario, registro, token_de_verificacion

CLAVE = "caparazon123"


@pytest.fixture
def buzon():
    b = correo.BuzonMemoria()
    correo.usar_transporte(b)
    yield b
    correo.usar_transporte(None)


def _pedir(u, direccion, clave=CLAVE):
    return u.post("/api/cuenta/correo", json={"correo": direccion, "contrasena_actual": clave})


def _verificar(cliente, token):
    return cliente.post("/api/cuenta/correo/verificar", json={"token": token})


def _sql(consulta: str, **p):
    with motor().begin() as c:
        return c.execute(text(consulta), p)


# ---------------------------------------------------------------- consulta y datos


def test_sin_sesion_no_hay_perfil():
    c = TestClient(app)
    assert c.get("/api/cuenta").status_code == 401
    assert c.patch("/api/cuenta", json={"nombre_completo": "X"}).status_code == 401
    assert c.post("/api/cuenta/correo", json={"correo": "a@b.co", "contrasena_actual": CLAVE}).status_code == 401
    assert c.post("/api/cuenta/sesiones/cerrar-otras").status_code == 401


def test_consultar_y_editar_el_nombre(ana):
    p = ana.get("/api/cuenta").json()
    assert (p["nombre_usuario"], p["correo"], p["correo_verificado"], p["correo_pendiente"]) == ("ana", None, False, None)
    assert p["sesiones_activas"] == 1
    assert not {"contrasena_hash", "token_hash"} & set(p)

    r = ana.patch("/api/cuenta", json={"nombre_completo": "  Ana   María  Prueba "})
    assert r.status_code == 200 and r.json()["nombre_completo"] == "Ana María Prueba"
    assert ana.get("/api/auth/yo").json()["nombre_completo"] == "Ana María Prueba"
    assert ana.patch("/api/cuenta", json={"nombre_completo": "   "}).status_code == 422
    # El nombre de usuario no se edita (no está en el formulario).
    ana.patch("/api/cuenta", json={"nombre_completo": "Ana", "nombre_usuario": "otra"})
    assert ana.get("/api/cuenta").json()["nombre_usuario"] == "ana"


# ---------------------------------------------------------------- correo


def test_agregar_correo_exige_contrasena_y_queda_pendiente_hasta_verificar(ana, buzon):
    r = _pedir(ana, "ana@ejemplo.co", clave="equivocada")
    assert r.status_code == 422 and "contrasena_actual" in r.json()["errores"]
    assert buzon.enviados == []

    r = _pedir(ana, "  Ana@Ejemplo.CO ")
    assert r.status_code == 200, r.text
    assert [c.para for c in buzon.enviados] == ["ana@ejemplo.co"]
    p = ana.get("/api/cuenta").json()
    # Aún no es el correo de la cuenta: solo está pendiente.
    assert (p["correo"], p["correo_verificado"], p["correo_pendiente"]) == (None, False, "ana@ejemplo.co")

    r = _verificar(TestClient(app), token_de_verificacion(buzon))  # sin sesión: otro dispositivo
    assert r.status_code == 200, r.text
    assert r.json()["correo"] == "ana@ejemplo.co"
    p = ana.get("/api/cuenta").json()
    assert (p["correo"], p["correo_verificado"], p["correo_pendiente"]) == ("ana@ejemplo.co", True, None)
    assert ana.get("/api/auth/yo").json()["correo_verificado"] is True


def test_el_token_se_guarda_solo_como_hash_y_sirve_una_vez(ana, buzon):
    _pedir(ana, "ana@ejemplo.co")
    token = token_de_verificacion(buzon)
    guardado = _sql("SELECT token_hash FROM verificacion_correo").scalar_one()
    assert token not in guardado and len(guardado) == 64

    assert _verificar(ana, token).status_code == 200
    r = _verificar(ana, token)
    assert r.status_code == 422 and "no es válido" in r.json()["detail"]


def test_token_invalido_o_vencido(ana, buzon):
    assert _verificar(ana, "no-existe").status_code == 422
    _pedir(ana, "ana@ejemplo.co")
    token = token_de_verificacion(buzon)
    _sql("UPDATE verificacion_correo SET creada_en = now() - interval '2 days', expira_en = now() - interval '1 second'")
    assert _verificar(ana, token).status_code == 422
    assert ana.get("/api/cuenta").json()["correo"] is None


def test_un_enlace_nuevo_anula_el_anterior_y_hay_espera_entre_envios(ana, buzon):
    _pedir(ana, "uno@ejemplo.co")
    primero = token_de_verificacion(buzon)
    r = _pedir(ana, "dos@ejemplo.co")
    assert r.status_code == 429  # menos de un minuto
    _sql("UPDATE verificacion_correo SET creada_en = now() - interval '2 minutes'")
    assert _pedir(ana, "dos@ejemplo.co").status_code == 200
    segundo = token_de_verificacion(buzon)
    assert _verificar(ana, primero).status_code == 422
    assert _verificar(ana, segundo).status_code == 200
    assert ana.get("/api/cuenta").json()["correo"] == "dos@ejemplo.co"


def test_cancelar_el_cambio_pendiente(ana, buzon):
    _pedir(ana, "ana@ejemplo.co")
    token = token_de_verificacion(buzon)
    assert ana.delete("/api/cuenta/correo/pendiente").status_code == 204
    assert ana.get("/api/cuenta").json()["correo_pendiente"] is None
    assert _verificar(ana, token).status_code == 422


def test_cambiar_correo_conserva_el_anterior_hasta_verificar_y_avisa(ana, buzon):
    _pedir(ana, "vieja@ejemplo.co")
    _verificar(ana, token_de_verificacion(buzon))
    _sql("UPDATE verificacion_correo SET creada_en = now() - interval '2 minutes'")

    assert _pedir(ana, "nueva@ejemplo.co").status_code == 200
    p = ana.get("/api/cuenta").json()
    assert (p["correo"], p["correo_verificado"], p["correo_pendiente"]) == ("vieja@ejemplo.co", True, "nueva@ejemplo.co")

    assert _verificar(ana, token_de_verificacion(buzon)).status_code == 200
    assert ana.get("/api/cuenta").json()["correo"] == "nueva@ejemplo.co"
    aviso = buzon.enviados[-1]
    assert aviso.para == "vieja@ejemplo.co" and "cambió" in aviso.asunto
    # Pedir de nuevo el mismo correo ya verificado no tiene sentido.
    _sql("UPDATE verificacion_correo SET creada_en = now() - interval '2 minutes'")
    assert _pedir(ana, "Nueva@Ejemplo.co").status_code == 422


def test_no_permite_averiguar_si_un_correo_esta_en_uso(ana, buzon):
    beto = Usuario("beto")
    _pedir(beto, "beto@ejemplo.co")
    _verificar(beto, token_de_verificacion(buzon))
    buzon.enviados.clear()

    libre = _pedir(ana, "libre@ejemplo.co")
    _sql("UPDATE verificacion_correo SET creada_en = now() - interval '2 minutes'")
    ocupado = _pedir(ana, "beto@ejemplo.co")
    assert libre.status_code == ocupado.status_code == 200
    assert libre.json()["mensaje"].replace("libre", "X") == ocupado.json()["mensaje"].replace("beto", "X")
    # Al ocupado no se le envía nada y la cuenta de beto no cambia.
    assert [c.para for c in buzon.enviados] == ["libre@ejemplo.co"]
    assert beto.get("/api/cuenta").json()["correo"] == "beto@ejemplo.co"
    # Y el enlace pendiente anterior (libre@) quedó anulado como en el caso normal.
    assert ana.get("/api/cuenta").json()["correo_pendiente"] is None


def test_quien_verifica_recupera_un_correo_escrito_sin_verificar_en_otra_cuenta(cliente, buzon):
    # Alguien registra una cuenta con un correo ajeno (queda sin verificar).
    assert cliente.post("/api/auth/registro", json=registro("intruso", correo="duena@ejemplo.co")).status_code == 201
    buzon.enviados.clear()
    duena = Usuario("duena")
    assert _pedir(duena, "duena@ejemplo.co").status_code == 200
    assert _verificar(duena, token_de_verificacion(buzon)).status_code == 200
    assert duena.get("/api/cuenta").json()["correo"] == "duena@ejemplo.co"
    assert cliente.get("/api/cuenta").json()["correo"] is None


def test_sin_transporte_de_correo_no_se_puede_verificar(ana, monkeypatch):
    monkeypatch.setattr(correo, "_transporte", lambda: None)  # HICOTEA_CORREO_MODO=ninguno
    r = _pedir(ana, "ana@ejemplo.co")
    assert r.status_code == 503 and r.json()["codigo"] == "CORREO_NO_CONFIGURADO"
    assert ana.get("/api/cuenta").json()["correo_disponible"] is False


def test_cuenta_bloqueada_no_verifica(ana, buzon):
    _pedir(ana, "ana@ejemplo.co")
    token = token_de_verificacion(buzon)
    _sql("UPDATE usuario SET activo = FALSE WHERE nombre_usuario = 'ana'")
    assert _verificar(TestClient(app), token).status_code == 422
    _sql("UPDATE usuario SET activo = TRUE WHERE nombre_usuario = 'ana'")
    assert _sql("SELECT correo FROM usuario WHERE nombre_usuario = 'ana'").scalar_one() is None


def test_limite_de_enlaces_invalidos_por_ip(ana):
    for _ in range(10):
        _verificar(ana, "malo")
    assert _verificar(ana, "malo").status_code == 429


def test_limite_de_contrasena_actual_equivocada(ana, buzon):
    for _ in range(5):
        assert _pedir(ana, "ana@ejemplo.co", clave="equivocada").status_code == 422
    assert _pedir(ana, "ana@ejemplo.co").status_code == 429


# ---------------------------------------------------------------- recuperación y verificación


def test_un_correo_sin_verificar_no_recibe_el_pin_ni_identifica_la_cuenta(cliente, buzon, monkeypatch, caplog):
    assert cliente.post("/api/auth/registro", json=registro("tortuga", correo="tortuga@ejemplo.co")).status_code == 201
    buzon.enviados.clear()
    monkeypatch.setattr(secrets, "randbelow", lambda _: 515151)
    with caplog.at_level(logging.INFO, logger="hicotea"):
        cliente.post("/api/auth/recuperar", json={"nombre_usuario": "tortuga"})
    assert buzon.enviados == [] and "515151" in caplog.text  # al log, para quien administra

    # Por correo sin verificar no se encuentra la cuenta (misma respuesta genérica).
    _sql("UPDATE recuperacion_contrasena SET fecha_creacion = now() - interval '2 minutes'")
    caplog.clear()
    with caplog.at_level(logging.INFO, logger="hicotea"):
        r = cliente.post("/api/auth/recuperar", json={"nombre_usuario": "tortuga@ejemplo.co"})
    assert r.status_code == 200 and "inexistente" in caplog.text


def test_el_registro_con_correo_envia_el_enlace(cliente, buzon):
    r = cliente.post("/api/auth/registro", json=registro("tortuga", correo="tortuga@ejemplo.co"))
    assert r.status_code == 201 and r.json()["correo_verificado"] is False
    assert [c.para for c in buzon.enviados] == ["tortuga@ejemplo.co"]
    assert cliente.get("/api/cuenta").json()["correo_pendiente"] == "tortuga@ejemplo.co"
    assert _verificar(cliente, token_de_verificacion(buzon)).status_code == 200
    assert cliente.get("/api/auth/yo").json()["correo_verificado"] is True


def test_verificar_un_correo_anula_los_pin_pendientes(ana, buzon, monkeypatch):
    """Un PIN pedido antes del cambio pudo ir a otra parte: deja de valer."""
    monkeypatch.setattr(secrets, "randbelow", lambda _: 777777)
    ana.post("/api/auth/recuperar", json={"nombre_usuario": "ana"})
    _pedir(ana, "ana@ejemplo.co")
    _verificar(ana, token_de_verificacion(buzon))
    r = ana.post("/api/auth/restablecer", json={
        "nombre_usuario": "ana", "pin": "777777", "contrasena": "otra-clave-77", "confirmacion_contrasena": "otra-clave-77",
    })
    assert r.status_code == 422


# ---------------------------------------------------------------- contraseña y sesiones


def test_cambiar_contrasena_cierra_las_demas_sesiones_y_conserva_esta(ana, buzon):
    otra = TestClient(app)
    assert otra.post("/api/auth/login", json={"nombre_usuario": "ana", "contrasena": CLAVE}).status_code == 200
    assert ana.get("/api/cuenta").json()["sesiones_activas"] == 2

    base = {"contrasena": "tortuga-lenta-9", "confirmacion_contrasena": "tortuga-lenta-9"}
    r = ana.post("/api/cuenta/contrasena", json={**base, "contrasena_actual": "equivocada"})
    assert r.status_code == 422 and "contrasena_actual" in r.json()["errores"]
    r = ana.post("/api/cuenta/contrasena", json={"contrasena_actual": CLAVE, "contrasena": "12345678", "confirmacion_contrasena": "12345678"})
    assert r.status_code == 422 and "contrasena" in r.json()["errores"]
    r = ana.post("/api/cuenta/contrasena", json={"contrasena_actual": CLAVE, "contrasena": CLAVE, "confirmacion_contrasena": CLAVE})
    assert r.status_code == 422

    r = ana.post("/api/cuenta/contrasena", json={**base, "contrasena_actual": CLAVE})
    assert r.status_code == 200 and r.json()["cerradas"] == 1
    assert ana.get("/api/cuenta").status_code == 200  # esta sesión sigue
    assert otra.get("/api/auth/yo").status_code == 401  # la otra no
    assert ana.post("/api/auth/login", json={"nombre_usuario": "ana", "contrasena": "tortuga-lenta-9"}).status_code == 200


def test_cerrar_las_demas_sesiones(ana):
    otra = TestClient(app)
    otra.post("/api/auth/login", json={"nombre_usuario": "ana", "contrasena": CLAVE})
    r = ana.post("/api/cuenta/sesiones/cerrar-otras")
    assert r.status_code == 200 and r.json()["cerradas"] == 1
    assert otra.get("/api/auth/yo").status_code == 401
    assert ana.get("/api/auth/yo").status_code == 200
    assert ana.post("/api/cuenta/sesiones/cerrar-otras").json()["cerradas"] == 0


def test_un_usuario_no_toca_el_perfil_de_otro(ana, buzon):
    beto = Usuario("beto")
    _pedir(beto, "beto@ejemplo.co")
    token_beto = token_de_verificacion(buzon)
    # Ana no ve ni cancela lo pendiente de beto.
    assert ana.get("/api/cuenta").json()["correo_pendiente"] is None
    ana.delete("/api/cuenta/correo/pendiente")
    assert beto.get("/api/cuenta").json()["correo_pendiente"] == "beto@ejemplo.co"
    # El token de beto, usado desde la sesión de ana, verifica la cuenta de beto (no la de ana).
    assert _verificar(ana, token_beto).status_code == 200
    assert ana.get("/api/cuenta").json()["correo"] is None
    assert beto.get("/api/cuenta").json()["correo"] == "beto@ejemplo.co"
