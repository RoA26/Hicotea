"""Envío de enlaces de verificación de correo.

Lo usan el registro (si la cuenta nace con correo) y el perfil (agregar,
cambiar o volver a verificar). Separado de `servicios/cuenta.py` para que
`servicios/auth.py` pueda usarlo sin importaciones circulares.

- Token de 256 bits (`secrets.token_urlsafe(32)`); en la base solo su SHA-256.
- Vence en `HORAS_VIGENCIA` y sirve una sola vez.
- Un enlace nuevo anula los anteriores del mismo usuario.
"""

import logging
from datetime import timedelta
from urllib.parse import quote

from sqlalchemy import Connection

from app import correo
from app.config import config
from app.repos import verificacion as repo
from app.seguridad.sesion import hash_token, nuevo_token

HORAS_VIGENCIA = 24
log = logging.getLogger("hicotea")


def enlace(token: str) -> str:
    return f"{config().url_publica.rstrip('/')}/verificar-correo?token={quote(token)}"


def enviar_enlace(con: Connection, usuario: dict, direccion: str) -> bool:
    """Anula los enlaces previos, crea uno nuevo para `direccion` y lo envía.
    Devuelve False si no hay transporte de correo o el envío falló (el enlace
    creado queda en la transacción; quien llama decide si revertir)."""
    if not correo.disponible():
        return False
    repo.anular_pendientes(con, usuario["id"])
    token = nuevo_token()
    repo.crear(con, usuario["id"], direccion, hash_token(token), timedelta(hours=HORAS_VIGENCIA))
    enviado = correo.enviar(correo.Correo(
        para=direccion,
        asunto="Confirma tu correo en Hicotea",
        texto=(
            f"Hola, {usuario['nombre_completo']}.\n\n"
            f"Para usar esta dirección en tu cuenta de Hicotea ({usuario['nombre_usuario']}), abre este enlace:\n\n"
            f"{enlace(token)}\n\n"
            f"Vence en {HORAS_VIGENCIA} horas y sirve una sola vez. Mientras no lo abras, "
            "esta dirección no recibirá el PIN de recuperación.\n\n"
            "Si no lo pediste, ignora este correo: nada cambia."
        ),
    ))
    if enviado:
        log.info("Enlace de verificación de correo enviado al usuario id=%s.", usuario["id"])
    return enviado
