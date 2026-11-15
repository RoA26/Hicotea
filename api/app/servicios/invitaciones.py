"""Invitaciones de un solo uso para registrarse.

El token es aleatorio (32 bytes, url-safe) y solo se guarda su SHA-256: el
enlace completo se muestra una única vez, al crearla. Un SHA-256 basta (no
hace falta argon2) porque el token tiene 256 bits de entropía y no se puede
adivinar por fuerza bruta, a diferencia de una contraseña."""

import hmac
from datetime import timedelta
from urllib.parse import quote

from sqlalchemy import Connection

from app.config import config
from app.errores import ReglaNegocio
from app.repos import admin as repo
from app.seguridad.sesion import hash_token, nuevo_token

INVITACION_INVALIDA = "La invitación no es válida, ya se usó, se revocó o venció. Pide una nueva."


def enlace(token: str) -> str:
    return f"{config().url_publica.rstrip('/')}/registro?invitacion={quote(token)}"


def crear(
    con: Connection, creada_por: int | None, dias: int | None = None, correo: str | None = None, nota: str | None = None
) -> tuple[dict, str]:
    """Devuelve (invitación, token en claro). El token no se vuelve a poder leer."""
    token = nuevo_token()
    vigencia = timedelta(days=dias or config().invitacion_dias)
    inv = repo.invitacion_crear(con, hash_token(token), vigencia, creada_por, correo, (nota or "").strip() or None)
    return inv, token


def es_codigo_heredado(ingresado: str) -> bool:
    """Código global de `HICOTEA_CODIGO_INVITACION`, si sigue configurado.
    Comparación en tiempo constante."""
    heredado = config().codigo_heredado
    return heredado is not None and hmac.compare_digest(heredado.encode(), ingresado.strip().encode())


def consultar(con: Connection, token: str) -> dict | None:
    """Para la pantalla de registro: dice si el enlace sirve y a qué correo va (si tiene)."""
    token = token.strip()
    if not token:
        return None
    if es_codigo_heredado(token):
        return {"correo": None}
    return repo.invitacion_vigente_por_hash(con, hash_token(token))


def consumir(con: Connection, token: str, correo: str | None) -> dict | None:
    """Valida y gasta la invitación dentro de la transacción del registro.
    Devuelve la invitación consumida, o None si se usó el código heredado.
    Lanza ReglaNegocio si no es válida."""
    token = token.strip()
    if es_codigo_heredado(token):
        return None
    inv = repo.invitacion_consumir(con, hash_token(token)) if token else None
    if inv is None:
        raise ReglaNegocio(INVITACION_INVALIDA, "codigo_invitacion")
    if inv["correo"] and (correo or "").strip().lower() != inv["correo"].lower():
        raise ReglaNegocio("Esta invitación es para otro correo electrónico.", "correo")
    return inv
