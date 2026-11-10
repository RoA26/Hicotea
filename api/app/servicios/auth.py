from datetime import timedelta

from sqlalchemy import Connection
from sqlalchemy.exc import IntegrityError

from app.config import config
from app.esquemas.auth import LoginForm, RegistroForm
from app.repos import sesion as repo_sesion
from app.repos import usuario as repo_usuario
from app.seguridad import hash as h
from app.seguridad.sesion import hash_token, nuevo_token


class UsuarioYaExiste(Exception):
    pass


class CredencialesInvalidas(Exception):
    pass


def _abrir_sesion(con: Connection, id_usuario: int) -> str:
    token = nuevo_token()
    repo_sesion.borrar_vencidas(con, id_usuario)
    repo_sesion.crear(con, hash_token(token), id_usuario, timedelta(days=config().sesion_dias))
    return token


def registrar(con: Connection, form: RegistroForm) -> tuple[dict, str]:
    nombre = form.nombre_usuario.strip().lower()
    if repo_usuario.existe(con, nombre):
        raise UsuarioYaExiste
    try:
        with con.begin_nested():
            usuario = repo_usuario.crear(
                con, nombre, form.nombre_completo.strip(), h.hashear(form.contrasena)
            )
    except IntegrityError as e:  # carrera entre dos registros simultáneos
        raise UsuarioYaExiste from e
    return usuario, _abrir_sesion(con, usuario["id"])


def iniciar_sesion(con: Connection, form: LoginForm) -> tuple[dict, str]:
    usuario = repo_usuario.por_nombre_usuario(con, form.nombre_usuario.strip().lower())
    hash_guardado = usuario["contrasena_hash"] if usuario and usuario["activo"] else None
    if not h.verificar(hash_guardado, form.contrasena):
        raise CredencialesInvalidas
    if h.necesita_rehash(hash_guardado):
        repo_usuario.actualizar_hash(con, usuario["id"], h.hashear(form.contrasena))
    usuario.pop("contrasena_hash")
    return usuario, _abrir_sesion(con, usuario["id"])


def cerrar_sesion(con: Connection, token: str | None) -> None:
    if token:
        repo_sesion.borrar(con, hash_token(token))
