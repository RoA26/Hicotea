"""Los flujos reales (verificación, PIN y avisos) con las plantillas HTML, y la
configuración SMTP leída de verdad (sin reemplazar el transporte)."""

import email
import logging
import re
import secrets
from email import policy

import pytest
from sqlalchemy import text

from app import correo
from app.config import Config
from app.db import motor
from tests.integracion.conftest import registro, token_de_verificacion


@pytest.fixture
def buzon():
    b = correo.BuzonMemoria()
    correo.usar_transporte(b)
    yield b
    correo.usar_transporte(None)


def _enlaces(html: str) -> list[str]:
    return [h.replace("&amp;", "&") for h in re.findall(r'href="([^"]+)"', html)]


def test_verificacion_html_y_texto_llevan_el_mismo_enlace_de_un_solo_uso(cliente, buzon):
    r = cliente.post("/api/auth/registro", json=registro("tortuga", correo="tortuga@ejemplo.co"))
    assert r.status_code == 201
    c = buzon.enviados[-1]
    assert c.html and c.asunto == "Confirma tu correo en Hicotea"
    token = token_de_verificacion(buzon)
    enlace_texto = re.search(r"\S+/verificar-correo\?token=\S+", c.texto).group(0)
    assert enlace_texto in _enlaces(c.html)
    assert "24 horas" in c.texto and "24 horas" in c.html
    # MIME completo, como saldría por SMTP.
    m = email.message_from_bytes(bytes(correo.componer(c, "Hicotea <no-responder@hicotea.co>")), policy=policy.default)
    assert [p.get_content_type() for p in m.iter_parts()] == ["text/plain", "text/html"]
    # Un solo uso.
    assert cliente.post("/api/cuenta/correo/verificar", json={"token": token}).status_code == 200
    assert cliente.post("/api/cuenta/correo/verificar", json={"token": token}).status_code == 422


def test_pin_y_aviso_de_cambio_en_html(cliente, buzon, monkeypatch, caplog):
    cliente.post("/api/auth/registro", json=registro("tortuga", correo="tortuga@ejemplo.co"))
    cliente.post("/api/cuenta/correo/verificar", json={"token": token_de_verificacion(buzon)})
    buzon.enviados.clear()
    monkeypatch.setattr(secrets, "randbelow", lambda _: 424242)
    with caplog.at_level(logging.INFO, logger="hicotea"):
        cliente.post("/api/auth/recuperar", json={"nombre_usuario": "tortuga"})
    pin = buzon.enviados[-1]
    assert "424242" in pin.texto and "424242" in pin.html and "424242" not in pin.asunto
    assert "15 minutos" in pin.html and "5 intentos" in pin.html
    assert "424242" not in caplog.text
    r = cliente.post("/api/auth/restablecer", json={"nombre_usuario": "tortuga", "pin": "424242",
                                                     "contrasena": "nueva-clave-1", "confirmacion_contrasena": "nueva-clave-1"})
    assert r.status_code == 200
    aviso = buzon.enviados[-1]
    assert aviso.asunto == "Tu contraseña de Hicotea cambió" and "restableció con un PIN" in aviso.html
    assert "avisa de inmediato" in aviso.texto


def test_el_aviso_de_cambio_de_correo_escapa_la_direccion_nueva(cliente, buzon):
    cliente.post("/api/auth/registro", json=registro("tortuga", correo="tortuga@ejemplo.co"))
    clave = registro("tortuga")["contrasena"]
    cliente.post("/api/cuenta/correo/verificar", json={"token": token_de_verificacion(buzon)})
    with motor().begin() as c:  # pasa el minuto de espera entre enlaces
        c.execute(text("UPDATE verificacion_correo SET creada_en = creada_en - interval '2 minutes'"))
    r = cliente.post("/api/cuenta/correo", json={"correo": "o'neil+hicotea@ejemplo.co", "contrasena_actual": clave})
    assert r.status_code == 200, r.text
    assert cliente.post("/api/cuenta/correo/verificar", json={"token": token_de_verificacion(buzon)}).status_code == 200
    aviso = buzon.enviados[-1]
    assert aviso.para == "tortuga@ejemplo.co" and aviso.asunto == "El correo de tu cuenta de Hicotea cambió"
    assert "o&#x27;neil+hicotea@ejemplo.co" in aviso.html and "o'neil+hicotea@ejemplo.co" in aviso.texto


def test_smtp_incompleto_no_habilita_la_verificacion(cliente, monkeypatch):
    """Sin reemplazar el transporte: la configuración real decide."""
    incompleta = Config(_env_file=None, correo_modo="smtp", smtp_host=None,
                        correo_remitente="Hicotea <no-responder@hicotea.co>")
    monkeypatch.setattr(correo, "config", lambda: incompleta)
    r = cliente.post("/api/auth/registro", json=registro("tortuga"))
    assert r.status_code == 201
    assert cliente.get("/api/cuenta").json()["correo_disponible"] is False
    clave = registro("tortuga")["contrasena"]
    r = cliente.post("/api/cuenta/correo", json={"correo": "t@ejemplo.co", "contrasena_actual": clave})
    assert r.status_code == 503 and r.json()["codigo"] == "CORREO_NO_CONFIGURADO"


def test_smtp_completo_habilita_la_verificacion(cliente, monkeypatch):
    completa = Config(_env_file=None, correo_modo="smtp", smtp_host="smtp.proveedor.test", smtp_puerto=465,
                      smtp_seguridad="ssl", smtp_usuario="resend", smtp_contrasena="x",
                      correo_remitente="Hicotea <no-responder@hicotea.co>", url_publica="https://hicotea.duckdns.org")
    monkeypatch.setattr(correo, "config", lambda: completa)
    cliente.post("/api/auth/registro", json=registro("tortuga"))
    assert cliente.get("/api/cuenta").json()["correo_disponible"] is True
