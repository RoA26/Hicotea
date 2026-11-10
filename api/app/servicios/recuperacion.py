""""Olvidé mi contraseña" sin servidor de correo: se genera un PIN de 6
dígitos que solo aparece en la consola del servidor. Quien administra el
servidor se lo entrega al usuario.

Controles:
 - El PIN se guarda solo como hash argon2, vence en 15 minutos y admite 5 intentos.
 - Un PIN nuevo anula los anteriores; no se genera otro antes de 60 segundos.
 - La respuesta al solicitar es idéntica exista o no el usuario.
"""

import logging
import re
import secrets

from sqlalchemy import Connection

from app.errores import ReglaNegocio
from app.repos import otros as repo
from app.repos import sesion as repo_sesion
from app.repos import usuario as repo_usuario
from app.seguridad import hash as h

MINUTOS_VIGENCIA = 15
MAXIMO_INTENTOS = 5
SEGUNDOS_ENTRE_SOLICITUDES = 60
PIN_INVALIDO = "El PIN no es válido o ya venció. Solicita uno nuevo."

log = logging.getLogger("hicotea.recuperacion")


def _para_log(texto: str) -> str:
    """Evita que un texto con saltos de línea falsifique entradas en el log."""
    return re.sub(r"[\r\n\t]", "_", texto or "")


def solicitar(con: Connection, nombre_usuario: str) -> None:
    nombre = nombre_usuario.strip().lower()
    usuario = repo_usuario.por_nombre_usuario(con, nombre)
    if usuario is None or not usuario["activo"]:
        log.info("Recuperación solicitada para una cuenta inexistente o inactiva: '%s'", _para_log(nombre))
        return
    if repo.recuperacion_reciente(con, usuario["id"], SEGUNDOS_ENTRE_SOLICITUDES):
        log.info("Recuperación ignorada para '%s': ya se generó un PIN hace menos de %s segundos.",
                 _para_log(nombre), SEGUNDOS_ENTRE_SOLICITUDES)
        return
    repo.recuperacion_anular_pendientes(con, usuario["id"])
    pin = f"{secrets.randbelow(1_000_000):06d}"
    repo.recuperacion_insertar(con, usuario["id"], h.hashear(pin), MINUTOS_VIGENCIA)
    log.warning(
        "\n==================== HICOTEA: RECUPERACIÓN DE CONTRASEÑA ====================\n"
        "  Usuario: %s\n  PIN:     %s\n  Vence en %s minutos. Máximo %s intentos.\n"
        "=============================================================================",
        _para_log(nombre), pin, MINUTOS_VIGENCIA, MAXIMO_INTENTOS,
    )


def restablecer(con: Connection, nombre_usuario: str, pin: str, contrasena: str, confirmacion: str) -> None:
    """Valida el PIN y cambia la contraseña. Un intento fallido se guarda con
    commit antes de responder el error; si no, el límite de intentos no serviría."""
    if contrasena != confirmacion:
        raise ReglaNegocio("Las contraseñas no coinciden.", "confirmacion_contrasena")
    usuario = repo_usuario.por_nombre_usuario(con, nombre_usuario.strip().lower())
    if usuario is None or not usuario["activo"]:
        raise ReglaNegocio(PIN_INVALIDO, "pin")
    solicitud = repo.recuperacion_vigente_para_actualizar(con, usuario["id"], MAXIMO_INTENTOS)
    if solicitud is None:
        raise ReglaNegocio(PIN_INVALIDO, "pin")
    if not h.verificar(solicitud["pin_hash"], pin.strip()):
        intentos = repo.recuperacion_intento_fallido(con, solicitud["id"])
        restantes = MAXIMO_INTENTOS - intentos
        log.info("PIN incorrecto para el usuario id=%s (intento %s de %s).", usuario["id"], intentos, MAXIMO_INTENTOS)
        if restantes <= 0:
            repo.recuperacion_marcar_usada(con, solicitud["id"])
            con.commit()
            raise ReglaNegocio("Agotaste los intentos. Solicita un PIN nuevo.", "pin")
        con.commit()
        raise ReglaNegocio(f"PIN incorrecto. Te queda{'' if restantes == 1 else 'n'} {restantes} "
                           f"intento{'' if restantes == 1 else 's'}.", "pin")
    repo.recuperacion_marcar_usada(con, solicitud["id"])
    repo_usuario.actualizar_hash(con, usuario["id"], h.hashear(contrasena))
    # Quien tuviera la sesión abierta con la contraseña vieja queda fuera.
    repo_sesion.borrar_todas(con, usuario["id"])
    log.info("Contraseña restablecida para el usuario id=%s.", usuario["id"])
