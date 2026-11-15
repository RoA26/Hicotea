"""Recuperación de contraseña: entrega por correo, no enumeración, límites y sesiones."""

import logging
import secrets

import pytest
from sqlalchemy import text

from app import correo
from app.db import motor
from tests.integracion.conftest import registro, token_de_verificacion


@pytest.fixture
def buzon():
    b = correo.BuzonMemoria()
    correo.usar_transporte(b)
    yield b
    correo.usar_transporte(None)


@pytest.fixture
def con_correo(cliente, buzon):
    """Cuenta con correo **verificado** (el registro envía el enlace; se abre aquí)."""
    r = cliente.post("/api/auth/registro", json=registro("tortuga", correo="tortuga@ejemplo.co"))
    assert r.status_code == 201, r.text
    r = cliente.post("/api/cuenta/correo/verificar", json={"token": token_de_verificacion(buzon)})
    assert r.status_code == 200, r.text
    buzon.enviados.clear()
    return cliente


def _restablecer(cliente, ident, pin, clave="nueva-clave-1"):
    return cliente.post("/api/auth/restablecer", json={
        "nombre_usuario": ident, "pin": pin, "contrasena": clave, "confirmacion_contrasena": clave,
    })


def test_el_pin_llega_por_correo_y_no_queda_en_el_log(con_correo, buzon, monkeypatch, caplog):
    monkeypatch.setattr(secrets, "randbelow", lambda _: 424242)
    with caplog.at_level(logging.INFO, logger="hicotea"):
        r = con_correo.post("/api/auth/recuperar", json={"nombre_usuario": "Tortuga@Ejemplo.co"})
    assert r.status_code == 200
    assert [c.para for c in buzon.enviados] == ["tortuga@ejemplo.co"]
    assert "424242" in buzon.enviados[0].texto
    assert "424242" not in caplog.text

    assert _restablecer(con_correo, "tortuga@ejemplo.co", "424242").status_code == 200
    assert con_correo.get("/api/auth/yo").status_code == 401  # sesiones cerradas
    assert "cambió" in buzon.enviados[-1].asunto  # aviso de cambio


def test_sin_correo_el_pin_va_al_log_para_quien_administra(cliente, buzon, monkeypatch, caplog):
    cliente.post("/api/auth/registro", json=registro("tortuga"))
    monkeypatch.setattr(secrets, "randbelow", lambda _: 131313)
    with caplog.at_level(logging.INFO, logger="hicotea"):
        cliente.post("/api/auth/recuperar", json={"nombre_usuario": "tortuga"})
    assert buzon.enviados == [] and "131313" in caplog.text


def test_la_respuesta_no_permite_enumerar_cuentas(con_correo, buzon):
    respuestas = [
        con_correo.post("/api/auth/recuperar", json={"nombre_usuario": x}).json()
        for x in ("tortuga", "nadie", "nadie@ejemplo.co")
    ]
    assert respuestas[0] == respuestas[1] == respuestas[2]
    # Restablecer contra una cuenta inexistente responde igual que un PIN vencido.
    a = _restablecer(con_correo, "nadie", "000000").json()
    b = _restablecer(con_correo, "tortuga", "000000").json()  # PIN incorrecto (aún vigente)
    c = _restablecer(con_correo, "fantasma", "000000").json()
    assert a == c and a["errores"].keys() == b["errores"].keys() == {"pin"}


def test_solicitudes_de_pin_limitadas_por_ip(con_correo, buzon):
    for _ in range(5):
        assert con_correo.post("/api/auth/recuperar", json={"nombre_usuario": "tortuga"}).status_code == 200
    assert con_correo.post("/api/auth/recuperar", json={"nombre_usuario": "tortuga"}).status_code == 429


def test_la_nueva_contrasena_se_valida(con_correo, buzon, monkeypatch):
    monkeypatch.setattr(secrets, "randbelow", lambda _: 555555)
    con_correo.post("/api/auth/recuperar", json={"nombre_usuario": "tortuga"})
    for mala in ("12345678", "aaaaaaaa", "mi-tortuga-99"):
        r = _restablecer(con_correo, "tortuga", "555555", mala)
        assert r.status_code == 422 and "contrasena" in r.json()["errores"], mala
    # Los rechazos por contraseña no gastan intentos del PIN.
    with motor().connect() as c:
        assert c.execute(text("SELECT intentos FROM recuperacion_contrasena WHERE NOT usada")).scalar_one() == 0
    assert _restablecer(con_correo, "tortuga", "555555", "caparazon-nuevo").status_code == 200


def test_un_pin_nuevo_anula_el_anterior_y_restablecer_anula_todos(con_correo, buzon, monkeypatch):
    pines = iter([111111, 222222])
    monkeypatch.setattr(secrets, "randbelow", lambda _: next(pines))
    con_correo.post("/api/auth/recuperar", json={"nombre_usuario": "tortuga"})
    with motor().begin() as c:  # salta la espera de 60 s
        c.execute(text("UPDATE recuperacion_contrasena SET fecha_creacion = now() - interval '2 minutes'"))
    con_correo.post("/api/auth/recuperar", json={"nombre_usuario": "tortuga"})
    assert _restablecer(con_correo, "tortuga", "111111").status_code == 422
    assert _restablecer(con_correo, "tortuga", "222222").status_code == 200
    with motor().connect() as c:
        assert c.execute(text("SELECT COUNT(*) FROM recuperacion_contrasena WHERE NOT usada")).scalar_one() == 0


def test_un_fallo_del_servidor_de_correo_no_rompe_la_solicitud(con_correo, monkeypatch, caplog):
    class Roto:
        def enviar(self, _):
            raise ConnectionRefusedError

    correo.usar_transporte(Roto())
    try:
        monkeypatch.setattr(secrets, "randbelow", lambda _: 777777)
        with caplog.at_level(logging.INFO, logger="hicotea"):
            r = con_correo.post("/api/auth/recuperar", json={"nombre_usuario": "tortuga"})
        assert r.status_code == 200 and "777777" in caplog.text  # queda para quien administra
    finally:
        correo.usar_transporte(None)


def test_registro_rechaza_contrasenas_comunes_y_correo_repetido(con_correo):
    from fastapi.testclient import TestClient

    from app.main import app

    c = TestClient(app)
    r = c.post("/api/auth/registro", json=registro("liebre", contrasena="password1", confirmacion_contrasena="password1"))
    assert r.status_code == 422 and "contrasena" in r.json()["errores"]
    r = c.post("/api/auth/registro", json=registro("liebre", correo="TORTUGA@ejemplo.co"))
    assert r.status_code == 409 and "correo" in r.json()["errores"]
