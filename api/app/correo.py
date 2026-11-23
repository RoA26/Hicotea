"""Envío de correos con un transporte intercambiable.

`HICOTEA_CORREO_MODO` elige el transporte:
 - "ninguno": `disponible()` es False y nada se envía (quien llama decide qué hacer);
 - "consola": el correo se escribe en el log (solo desarrollo);
 - "smtp":    smtplib con STARTTLS, SSL o sin cifrado, según `HICOTEA_SMTP_SEGURIDAD`.
              Si la configuración está incompleta o es insegura, `disponible()` es
              False: no se ofrece verificar correos que nunca saldrían.

Un `Correo` lleva siempre texto plano y, opcionalmente, HTML; con HTML se envía
como multipart/alternative (texto primero, HTML después). Las plantillas están
en `app/plantillas_correo.py`.

Las pruebas reemplazan el transporte con `usar_transporte(BuzonMemoria())`.
Las credenciales SMTP solo se leen de la configuración: no hay valores por
defecto y nunca se escriben en el log.
"""

import logging
import smtplib
import socket
import ssl
from dataclasses import dataclass
from email.message import EmailMessage
from email.utils import formatdate, make_msgid, parseaddr
from typing import Protocol
from urllib.parse import urlparse

from app.config import Config, config

log = logging.getLogger("hicotea.correo")

_DOMINIOS_LOCALES = {"localhost", "localdomain", "example.com", "example.org", "example.net"}


@dataclass(frozen=True)
class Correo:
    para: str
    asunto: str
    texto: str
    html: str | None = None


class Transporte(Protocol):
    def enviar(self, correo: Correo) -> None: ...


# ====================================================================== configuración


def _dominio(direccion: str) -> str:
    return direccion.rpartition("@")[2].strip().lower()


def problemas_smtp(c: Config | None = None) -> list[str]:
    """Lo que impide enviar por SMTP con esta configuración (vacío = utilizable).
    Los mensajes nombran variables, nunca sus valores secretos."""
    c = c or config()
    problemas: list[str] = []
    if not (c.smtp_host or "").strip():
        problemas.append("Falta HICOTEA_SMTP_HOST.")
    usuario = (c.smtp_usuario or "").strip()
    contrasena = c.smtp_contrasena.get_secret_value() if c.smtp_contrasena else ""
    if usuario and not contrasena:
        problemas.append("HICOTEA_SMTP_USUARIO está definido pero falta HICOTEA_SMTP_CONTRASENA.")
    if contrasena and not usuario:
        problemas.append("HICOTEA_SMTP_CONTRASENA está definida pero falta HICOTEA_SMTP_USUARIO.")
    if usuario and c.smtp_seguridad == "ninguna":
        problemas.append("HICOTEA_SMTP_SEGURIDAD=ninguna con credenciales: la contraseña viajaría sin cifrar. "
                         "Usa starttls o ssl.")
    _, remitente = parseaddr(c.correo_remitente or "")
    dominio = _dominio(remitente) if "@" in remitente else ""
    if dominio in _DOMINIOS_LOCALES or dominio.endswith(".localhost"):
        problemas.append("HICOTEA_CORREO_REMITENTE usa un dominio de ejemplo o local: usa uno verificado en tu proveedor.")
    elif "." not in dominio:
        problemas.append("HICOTEA_CORREO_REMITENTE no es una dirección válida (p. ej. 'Hicotea <no-responder@tu-dominio>').")
    url = urlparse(c.url_publica or "")
    if url.scheme not in ("http", "https") or not url.netloc:
        problemas.append("HICOTEA_URL_PUBLICA debe ser una URL absoluta (https://…): los enlaces del correo salen de ella.")
    return problemas


def avisos_smtp(c: Config | None = None) -> list[str]:
    """Combinaciones que probablemente fallen o confundan, pero no se bloquean."""
    c = c or config()
    avisos: list[str] = []
    if c.smtp_seguridad == "starttls" and c.smtp_puerto in (465, 2465):
        avisos.append(f"El puerto {c.smtp_puerto} suele ser SSL implícito: usa HICOTEA_SMTP_SEGURIDAD=ssl.")
    if c.smtp_seguridad == "ssl" and c.smtp_puerto in (25, 587, 2587):
        avisos.append(f"El puerto {c.smtp_puerto} suele usar STARTTLS: usa HICOTEA_SMTP_SEGURIDAD=starttls.")
    host = urlparse(c.url_publica or "").hostname or ""
    if host in ("localhost", "127.0.0.1", "::1"):
        avisos.append("HICOTEA_URL_PUBLICA apunta a este equipo: los enlaces solo abrirán aquí.")
    elif urlparse(c.url_publica or "").scheme == "http":
        avisos.append("HICOTEA_URL_PUBLICA usa http: en producción los enlaces deben ser https.")
    return avisos


def revisar_al_arrancar() -> None:
    """Deja en el log (sin secretos) por qué el correo no está disponible."""
    c = config()
    if c.correo_modo == "smtp":
        problemas = problemas_smtp(c)
        if problemas:
            log.error("Correo SMTP deshabilitado por configuración incompleta: %s", " ".join(problemas))
        for aviso in avisos_smtp(c):
            log.warning("Correo SMTP: %s", aviso)
    elif c.correo_modo == "consola" and c.cookie_secure:
        log.warning("HICOTEA_CORREO_MODO=consola con cookie segura: los correos (con enlaces y PIN) se "
                    "escriben en el log. Es solo para desarrollo.")


# ====================================================================== composición


def componer(correo: Correo, remitente: str) -> EmailMessage:
    """Mensaje MIME: text/plain solo, o multipart/alternative (texto + HTML).
    `EmailMessage` rechaza saltos de línea en cabeceras (sin inyección)."""
    mensaje = EmailMessage()
    mensaje["From"] = remitente
    mensaje["To"] = correo.para
    mensaje["Subject"] = correo.asunto
    mensaje["Date"] = formatdate(localtime=False, usegmt=True)
    dominio = _dominio(parseaddr(remitente)[1]) or None
    mensaje["Message-ID"] = make_msgid(domain=dominio)
    # Correo automático: que los autorrespondedores no contesten.
    mensaje["Auto-Submitted"] = "auto-generated"
    mensaje.set_content(correo.texto, charset="utf-8")
    if correo.html:
        mensaje.add_alternative(correo.html, subtype="html", charset="utf-8")
    return mensaje


# ====================================================================== transportes


class TransporteConsola:
    def enviar(self, correo: Correo) -> None:
        extra = f"\n(+ versión HTML, {len(correo.html)} caracteres)" if correo.html else ""
        log.warning(
            "\n==================== HICOTEA: CORREO (modo consola) ====================\n"
            "Para:   %s\nAsunto: %s\n\n%s%s\n"
            "========================================================================",
            correo.para, correo.asunto, correo.texto, extra,
        )


class TransporteSmtp:
    def __init__(self, c: Config | None = None) -> None:
        self.c = c or config()

    def enviar(self, correo: Correo) -> None:
        c = self.c
        problemas = problemas_smtp(c)
        if problemas:
            raise ConfiguracionIncompleta(" ".join(problemas))
        mensaje = componer(correo, c.correo_remitente)
        contexto = ssl.create_default_context()
        if c.smtp_seguridad == "ssl":
            servidor = smtplib.SMTP_SSL(c.smtp_host, c.smtp_puerto, timeout=c.smtp_timeout, context=contexto)
        else:
            servidor = smtplib.SMTP(c.smtp_host, c.smtp_puerto, timeout=c.smtp_timeout)
        with servidor:
            if c.smtp_seguridad == "starttls":
                servidor.starttls(context=contexto)
            if c.smtp_usuario:
                servidor.login(c.smtp_usuario, c.smtp_contrasena.get_secret_value() if c.smtp_contrasena else "")
            servidor.send_message(mensaje)


class ConfiguracionIncompleta(RuntimeError):
    pass


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
    c = config()
    if c.correo_modo == "consola":
        return TransporteConsola()
    if c.correo_modo == "smtp" and not problemas_smtp(c):
        return TransporteSmtp(c)
    return None


def disponible() -> bool:
    """True solo si hay un transporte que de verdad puede enviar."""
    return _transporte() is not None


def describir_error(e: BaseException) -> str:
    """Explicación para personas, sin repetir la respuesta del servidor (puede
    traer datos de la cuenta) ni las credenciales."""
    if isinstance(e, ConfiguracionIncompleta):
        return f"Configuración incompleta: {e}"
    if isinstance(e, smtplib.SMTPAuthenticationError):
        return "El servidor rechazó el usuario o la contraseña SMTP."
    if isinstance(e, smtplib.SMTPSenderRefused):
        return "El servidor rechazó el remitente: verifica el dominio de HICOTEA_CORREO_REMITENTE en tu proveedor."
    if isinstance(e, smtplib.SMTPRecipientsRefused):
        return "El servidor rechazó la dirección de destino."
    if isinstance(e, smtplib.SMTPNotSupportedError):
        return "El servidor no admite lo pedido (¿STARTTLS o AUTH?): revisa HICOTEA_SMTP_SEGURIDAD y el puerto."
    if isinstance(e, ssl.SSLError):
        return "Falló el cifrado TLS: revisa HICOTEA_SMTP_SEGURIDAD y el puerto (465 = ssl, 587 = starttls)."
    if isinstance(e, (socket.timeout, TimeoutError)):
        return "El servidor no respondió a tiempo (HICOTEA_SMTP_TIMEOUT): revisa el host, el puerto y el firewall."
    if isinstance(e, socket.gaierror):
        return "No se encontró el host SMTP: revisa HICOTEA_SMTP_HOST."
    if isinstance(e, ConnectionRefusedError):
        return "El servidor rechazó la conexión: revisa HICOTEA_SMTP_HOST y HICOTEA_SMTP_PUERTO."
    if isinstance(e, smtplib.SMTPServerDisconnected):
        return "El servidor cerró la conexión: suele ser un puerto con el cifrado equivocado."
    if isinstance(e, smtplib.SMTPResponseException):
        return f"El servidor respondió con el código {e.smtp_code}."
    if isinstance(e, OSError):
        return f"Error de red ({type(e).__name__})."
    return f"Error inesperado ({type(e).__name__})."


def enviar(correo: Correo) -> bool:
    """Envía y devuelve True si salió. Un fallo del servidor de correo no
    rompe la petición: se registra (sin el contenido ni la dirección) y devuelve False."""
    t = _transporte()
    if t is None:
        return False
    try:
        t.enviar(correo)
        return True
    except Exception as e:  # noqa: BLE001 — cualquier fallo de red/SMTP
        log.error("No se pudo enviar el correo '%s': %s %s", correo.asunto, type(e).__name__, describir_error(e))
        return False


def enviar_o_fallar(correo: Correo, transporte: Transporte | None = None) -> None:
    """Para el CLI de prueba: envía con el transporte dado (o el de la
    configuración) y deja pasar la excepción para explicarla."""
    t = transporte or _transporte()
    if t is None:
        raise ConfiguracionIncompleta("No hay transporte de correo (HICOTEA_CORREO_MODO=ninguno o SMTP incompleto).")
    t.enviar(correo)
