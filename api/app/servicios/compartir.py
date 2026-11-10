"""Acceso de solo lectura entre cuentas. El titular concede y revoca; el
invitado solo puede consultar. Toda vista compartida pasa primero por
`verificar`."""

from sqlalchemy import Connection

from app.errores import NoEncontrado, ReglaNegocio
from app.repos import otros as repo
from app.repos import usuario as repo_usuario


def concedidos(con: Connection, id_titular: int) -> list[dict]:
    return repo.acceso_concedidos(con, id_titular)


def recibidos(con: Connection, id_invitado: int) -> list[dict]:
    return repo.acceso_recibidos(con, id_invitado)


def conceder(con: Connection, id_titular: int, nombre_usuario: str) -> None:
    invitado = repo_usuario.por_nombre_usuario(con, nombre_usuario.strip().lower())
    # Mismo mensaje si no existe o está inactivo: no revelamos qué cuentas existen.
    if invitado is None or not invitado["activo"]:
        raise ReglaNegocio("No encontramos una cuenta activa con ese nombre de usuario.", "nombre_usuario")
    if invitado["id"] == id_titular:
        raise ReglaNegocio("Ese es tu propio usuario.", "nombre_usuario")
    if repo.acceso_buscar(con, id_titular, invitado["id"]) is not None:
        raise ReglaNegocio("Esa persona ya puede ver tu cuenta.", "nombre_usuario")
    repo.acceso_conceder(con, id_titular, invitado["id"])


def revocar(con: Connection, id_titular: int, id_acceso: int) -> None:
    if repo.acceso_revocar(con, id_titular, id_acceso) == 0:
        raise NoEncontrado("Acceso no encontrado")


def verificar(con: Connection, id_invitado: int, id_titular: int) -> dict:
    """Si el invitado no puede ver la cuenta, responde como si no existiera (404)."""
    acceso = repo.acceso_buscar(con, id_titular, id_invitado)
    if acceso is None:
        raise NoEncontrado("Cuenta no encontrada")
    return acceso
