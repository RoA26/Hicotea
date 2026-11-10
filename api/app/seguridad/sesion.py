"""Tokens de sesión: la cookie lleva el token; la BD guarda solo su SHA-256."""

import hashlib
import secrets

from fastapi import Response

from app.config import config


def nuevo_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def poner_cookie(respuesta: Response, token: str) -> None:
    c = config()
    respuesta.set_cookie(
        key=c.cookie_nombre,
        value=token,
        max_age=c.sesion_dias * 24 * 3600,
        path="/",
        httponly=True,
        samesite="lax",
        secure=c.cookie_secure,
    )


def borrar_cookie(respuesta: Response) -> None:
    c = config()
    respuesta.delete_cookie(
        key=c.cookie_nombre, path="/", httponly=True, samesite="lax", secure=c.cookie_secure
    )
