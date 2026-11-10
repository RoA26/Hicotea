import hmac
from datetime import timedelta

from sqlalchemy import Connection
from sqlalchemy.exc import IntegrityError

from app.config import config
from app.errores import ReglaNegocio
from app.esquemas.auth import LoginForm, RegistroForm
from app.repos import sesion as repo_sesion
from app.repos import usuario as repo_usuario
from app.seguridad import hash as h
from app.seguridad.sesion import hash_token, nuevo_token
from app.servicios import categorias

USUARIO_EN_USO = "Ese nombre de usuario ya está en uso."


class CredencialesInvalidas(Exception):
    pass


def normalizar(nombre_usuario: str) -> str:
    """Regla única de normalización (sin espacios y en minúsculas), al registrar y al autenticar."""
    return nombre_usuario.strip().lower()


def _abrir_sesion(con: Connection, id_usuario: int) -> str:
    token = nuevo_token()
    repo_sesion.borrar_vencidas(con, id_usuario)
    repo_sesion.crear(con, hash_token(token), id_usuario, timedelta(days=config().sesion_dias))
    return token


def _validar_codigo_invitacion(ingresado: str) -> None:
    """Comparación en tiempo constante para no filtrar información por tiempos de respuesta."""
    esperado = config().codigo_invitacion.encode()
    if not hmac.compare_digest(esperado, ingresado.strip().encode()):
        raise ReglaNegocio("El código de invitación no es válido.", "codigo_invitacion")


def registrar(con: Connection, form: RegistroForm) -> tuple[dict, str]:
    """Crea el usuario y sus categorías por defecto en la misma transacción."""
    _validar_codigo_invitacion(form.codigo_invitacion)
    if form.contrasena != form.confirmacion_contrasena:
        raise ReglaNegocio("Las contraseñas no coinciden.", "confirmacion_contrasena")
    nombre = normalizar(form.nombre_usuario)
    if repo_usuario.existe(con, nombre):
        raise ReglaNegocio(USUARIO_EN_USO, "nombre_usuario", estado=409)
    try:
        with con.begin_nested():
            usuario = repo_usuario.crear(con, nombre, form.nombre_completo.strip(), h.hashear(form.contrasena))
    except IntegrityError as e:  # dos registros simultáneos: la restricción UNIQUE decide
        raise ReglaNegocio(USUARIO_EN_USO, "nombre_usuario", estado=409) from e
    categorias.crear_por_defecto(con, usuario["id"])
    return usuario, _abrir_sesion(con, usuario["id"])


def iniciar_sesion(con: Connection, form: LoginForm) -> tuple[dict, str]:
    usuario = repo_usuario.por_nombre_usuario(con, normalizar(form.nombre_usuario))
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
