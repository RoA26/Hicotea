from datetime import timedelta

from sqlalchemy import Connection
from sqlalchemy.exc import IntegrityError

from app.config import config
from app.errores import ReglaNegocio
from app.esquemas.auth import LoginForm, RegistroForm
from app.repos import admin as repo_admin
from app.repos import sesion as repo_sesion
from app.repos import usuario as repo_usuario
from app.seguridad import hash as h
from app.seguridad.sesion import hash_token, nuevo_token
from app.servicios import categorias, invitaciones

USUARIO_EN_USO = "Ese nombre de usuario ya está en uso."
CORREO_EN_USO = "Ese correo ya está asociado a otra cuenta."

# Contraseñas demasiado comunes para aceptarlas aunque cumplan la longitud.
_COMUNES = {
    "12345678", "123456789", "1234567890", "password", "password1", "contraseña", "contrasena",
    "qwertyui", "qwerty123", "11111111", "00000000", "abcdefgh", "abc12345", "iloveyou", "hicotea1",
    "hicotea123", "colombia", "colombia1",
}


class CredencialesInvalidas(Exception):
    pass


class CuentaBloqueada(Exception):
    pass


def normalizar(nombre_usuario: str) -> str:
    """Regla única de normalización (sin espacios y en minúsculas), al registrar y al autenticar."""
    return nombre_usuario.strip().lower()


def normalizar_correo(correo: str | None) -> str | None:
    c = (correo or "").strip().lower()
    return c or None


def validar_contrasena(contrasena: str, confirmacion: str, nombre_usuario: str | None = None) -> None:
    """Reglas comunes al registrarse y al restablecer. La longitud (8–128) la valida el esquema."""
    if contrasena != confirmacion:
        raise ReglaNegocio("Las contraseñas no coinciden.", "confirmacion_contrasena")
    if contrasena.strip() != contrasena or not contrasena.strip():
        raise ReglaNegocio("La contraseña no puede empezar ni terminar con espacios.", "contrasena")
    minuscula = contrasena.lower()
    if minuscula in _COMUNES or len(set(contrasena)) < 3:
        raise ReglaNegocio("Esa contraseña es muy fácil de adivinar. Prueba con una frase o mezcla de palabras.", "contrasena")
    if nombre_usuario and normalizar(nombre_usuario) in minuscula:
        raise ReglaNegocio("La contraseña no puede contener tu nombre de usuario.", "contrasena")


def _abrir_sesion(con: Connection, id_usuario: int) -> str:
    token = nuevo_token()
    repo_sesion.borrar_vencidas(con, id_usuario)
    repo_sesion.crear(con, hash_token(token), id_usuario, timedelta(days=config().sesion_dias))
    repo_usuario.registrar_ingreso(con, id_usuario)
    return token


def registrar(con: Connection, form: RegistroForm) -> tuple[dict, str]:
    """Crea el usuario y sus categorías por defecto en la misma transacción que
    consume la invitación: si algo falla, la invitación sigue pendiente."""
    nombre = normalizar(form.nombre_usuario)
    correo = normalizar_correo(form.correo)
    validar_contrasena(form.contrasena, form.confirmacion_contrasena, nombre)
    # La invitación se valida antes que el usuario y el correo: sin una
    # invitación válida no se puede averiguar qué cuentas existen. Si después
    # algo falla, el rollback de la petición la devuelve a pendiente.
    invitacion = invitaciones.consumir(con, form.codigo_invitacion, correo)
    if invitacion and invitacion["correo"]:
        correo = invitacion["correo"].lower()
    if repo_usuario.existe(con, nombre):
        raise ReglaNegocio(USUARIO_EN_USO, "nombre_usuario", estado=409)
    if correo and repo_usuario.correo_en_uso(con, correo):
        raise ReglaNegocio(CORREO_EN_USO, "correo", estado=409)
    try:
        with con.begin_nested():
            usuario = repo_usuario.crear(con, nombre, form.nombre_completo.strip(), h.hashear(form.contrasena), correo)
    except IntegrityError as e:  # dos registros simultáneos: la restricción UNIQUE decide
        if "uq_usuario_correo" in str(e.orig):
            raise ReglaNegocio(CORREO_EN_USO, "correo", estado=409) from e
        raise ReglaNegocio(USUARIO_EN_USO, "nombre_usuario", estado=409) from e
    if invitacion:
        repo_admin.invitacion_asignar_usuario(con, invitacion["id"], usuario["id"])
    categorias.crear_por_defecto(con, usuario["id"])
    return usuario, _abrir_sesion(con, usuario["id"])


def iniciar_sesion(con: Connection, form: LoginForm) -> tuple[dict, str]:
    usuario = repo_usuario.por_nombre_usuario(con, normalizar(form.nombre_usuario))
    hash_guardado = usuario["contrasena_hash"] if usuario else None
    if not h.verificar(hash_guardado, form.contrasena):
        raise CredencialesInvalidas
    # Solo quien conoce la contraseña correcta se entera de que la cuenta está bloqueada.
    if not usuario["activo"]:
        raise CuentaBloqueada
    if h.necesita_rehash(hash_guardado):
        repo_usuario.actualizar_hash(con, usuario["id"], h.hashear(form.contrasena))
    usuario.pop("contrasena_hash")
    return usuario, _abrir_sesion(con, usuario["id"])


def cerrar_sesion(con: Connection, token: str | None) -> None:
    if token:
        repo_sesion.borrar(con, hash_token(token))
