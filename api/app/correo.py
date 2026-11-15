"""Envío de correos con un transporte intercambiable.

`HICOTEA_CORREO_MODO` elige el transporte:
 - "ninguno": `disponible()` es False y nada se envía (quien llama decide qué hacer);
 - "consola": el correo se escribe en el log (desarrollo local);
 - "smtp":    smtplib con STARTTLS, SSL o sin cifrado, según `HICOTEA_SMTP_SEGURIDAD`.

Las pruebas reemplazan el transporte con `usar_transporte(BuzonMemoria())`.
Las credenciales SMTP solo se leen de la configuración: no hay valores por defecto.
"""

import logging
import smtplib
import ssl
from dataclasses import dataclass
from email.message import EmailMessage
from typing import Protocol

from app.config import config

log = logging.getLogger("hicotea.correo")


@dataclass(frozen=True)
class Correo:
    para: str
    asunto: str
    texto: str


class Transporte(Protocol):
    def enviar(self, correo: Correo) -> None: ...


class TransporteConsola:
    def enviar(self, correo: Correo) -> None:
        log.warning(
            "\n==================== HICOTEA: CORREO (modo consola) ====================\n"
            "Para:   %s\nAsunto: %s\n\n%s\n"
            "========================================================================",
            correo.para, correo.asunto, correo.texto,
        )


class TransporteSmtp:
    def enviar(self, correo: Correo) -> None:
        c = config()
        if not c.smtp_host:
            raise RuntimeError("HICOTEA_SMTP_HOST no está configurado")
        mensaje = EmailMessage()
        mensaje["From"] = c.correo_remitente
        mensaje["To"] = correo.para
        mensaje["Subject"] = correo.asunto
        mensaje.set_content(correo.texto)
        contexto = ssl.create_default_context()
        if c.smtp_seguridad == "ssl":
            servidor = smtplib.SMTP_SSL(c.smtp_host, c.smtp_puerto, timeout=15, context=contexto)
        else:
            servidor = smtplib.SMTP(c.smtp_host, c.smtp_puerto, timeout=15)
        with servidor:
            if c.smtp_seguridad == "starttls":
                servidor.starttls(context=contexto)
            if c.smtp_usuario:
                servidor.login(c.smtp_usuario, c.smtp_contrasena or "")
            servidor.send_message(mensaje)


class BuzonMemoria:
    """Para pruebas: guarda los correos en una lista."""

    def __init__(self) -> None:
        self.enviados: list[Correo] = []

    def enviar(self, correo: Correo) -> None:
        self.enviados.append(correo)


_reemplazo: Transporte | None = None


def usar_transporte(t: Transporte | None) -> None:
    """Fija un transporte (pruebas). `None` vuelve al de la configuración."""
    global _reemplazo
    _reemplazo = t


def _transporte() -> Transporte | None:
    if _reemplazo is not None:
        return _reemplazo
    modo = config().correo_modo
    if modo == "consola":
        return TransporteConsola()
    if modo == "smtp":
        return TransporteSmtp()
    return None


def disponible() -> bool:
    return _transporte() is not None


def enviar(correo: Correo) -> bool:
    """Envía y devuelve True si salió. Un fallo del servidor de correo no
    rompe la petición: se registra (sin el contenido) y devuelve False."""
    t = _transporte()
    if t is None:
        return False
    try:
        t.enviar(correo)
        return True
    except Exception as e:  # noqa: BLE001 — cualquier fallo de red/SMTP
        log.error("No se pudo enviar el correo '%s': %s", correo.asunto, type(e).__name__)
        return False
