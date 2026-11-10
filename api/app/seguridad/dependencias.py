from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import Connection

from app.config import config
from app.db import conexion
from app.repos import sesion as repo_sesion
from app.seguridad.sesion import hash_token

Con = Annotated[Connection, Depends(conexion)]


def usuario_actual(request: Request, con: Con) -> dict:
    token = request.cookies.get(config().cookie_nombre)
    if token:
        usuario = repo_sesion.usuario_por_token(con, hash_token(token))
        if usuario is not None:
            return usuario
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, "No has iniciado sesión")


UsuarioActual = Annotated[dict, Depends(usuario_actual)]


def id_usuario_actual(usuario: UsuarioActual) -> int:
    return usuario["id"]


IdUsuario = Annotated[int, Depends(id_usuario_actual)]
