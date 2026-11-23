""""Olvidé mi contraseña" con PIN de 6 dígitos.

Entrega del PIN:
 - Si la cuenta tiene correo **verificado** y hay transporte de correo utilizable
   (`HICOTEA_CORREO_MODO` = "smtp" completo o "consola"), se envía por correo
   (plantilla `plantillas_correo.recuperacion_pin`) y **no** se escribe en el log.
 - Si no, se escribe en el log del servidor para que quien administra se lo
   entregue por un canal verificado (comportamiento previo).

Controles:
 - El PIN se guarda solo como hash argon2, vence en 15 minutos y admite 5 intentos.
 - Un PIN nuevo anula los anteriores; no se genera otro antes de 60 segundos.
 - La respuesta al solicitar es idéntica exista o no la cuenta, tenga o no correo.
 - Límite por IP y cuenta en la ruta (`limitador_recuperacion`).
 - Al restablecer se cierran todas las sesiones y se anulan los PIN pendientes.
"""

import logging
import re
import secrets

from sqlalchemy import Connection

from app import correo
from app import plantillas_correo as plantillas
from app.errores import ReglaNegocio
from app.repos import otros as repo
from app.repos import sesion as repo_sesion
from app.repos import usuario as repo_usuario
from app.seguridad import hash as h
from app.servicios.auth import validar_contrasena

MINUTOS_VIGENCIA = 15
MAXIMO_INTENTOS = 5
SEGUNDOS_ENTRE_SOLICITUDES = 60
PIN_INVALIDO = "El PIN no es válido o ya venció. Solicita uno nuevo."

log = logging.getLogger("hicotea.recuperacion")


def _para_log(texto: str) -> str:
    """Evita que un texto con saltos de línea falsifique entradas en el log."""
    return re.sub(r"[\r\n\t]", "_", texto or "")


def buscar_cuenta(con: Connection, identificador: str) -> dict | None:
    """Por nombre de usuario o, si trae @, por correo **verificado**: una
    dirección sin verificar no identifica la cuenta para recuperarla."""
    ident = identificador.strip().lower()
    if "@" in ident:
        return repo_usuario.por_correo(con, ident, solo_verificado=True)
    return repo_usuario.por_nombre_usuario(con, ident)


def solicitar(con: Connection, identificador: str) -> None:
    usuario = buscar_cuenta(con, identificador)
    if usuario is None or not usuario["activo"]:
        log.info("Recuperación solicitada para una cuenta inexistente o inactiva.")
        return
    nombre = usuario["nombre_usuario"]
    if repo.recuperacion_reciente(con, usuario["id"], SEGUNDOS_ENTRE_SOLICITUDES):
        log.info("Recuperación ignorada para '%s': ya se generó un PIN hace menos de %s segundos.",
                 _para_log(nombre), SEGUNDOS_ENTRE_SOLICITUDES)
        return
    repo.recuperacion_anular_pendientes(con, usuario["id"])
    pin = f"{secrets.randbelow(1_000_000):06d}"
    repo.recuperacion_insertar(con, usuario["id"], h.hashear(pin), MINUTOS_VIGENCIA)

    # Solo a un correo verificado: uno sin verificar podría no ser de la persona.
    if usuario.get("correo") and usuario.get("correo_verificado") and correo.disponible():
        mensaje = plantillas.recuperacion_pin(usuario["nombre_completo"], nombre, pin, MINUTOS_VIGENCIA, MAXIMO_INTENTOS)
        enviado = correo.enviar(mensaje.para(usuario["correo"]))
        if enviado:
            log.info("PIN de recuperación enviado por correo al usuario id=%s.", usuario["id"])
            return
        log.error("No se pudo enviar el PIN por correo al usuario id=%s; se deja en el log.", usuario["id"])
    log.warning(
        "\n==================== HICOTEA: RECUPERACIÓN DE CONTRASEÑA ====================\n"
        "  Usuario: %s\n  PIN:     %s\n  Vence en %s minutos. Máximo %s intentos.\n"
        "  Verifica la identidad por un canal acordado antes de entregarlo.\n"
        "=============================================================================",
        _para_log(nombre), pin, MINUTOS_VIGENCIA, MAXIMO_INTENTOS,
    )


def restablecer(con: Connection, identificador: str, pin: str, contrasena: str, confirmacion: str) -> None:
    """Valida el PIN y cambia la contraseña. Un intento fallido se guarda con
    commit antes de responder el error; si no, el límite de intentos no serviría."""
    # Se valida con lo que escribió la persona, no con la cuenta encontrada:
    # si no, el mensaje de error delataría si el usuario existe.
    validar_contrasena(contrasena, confirmacion, None if "@" in identificador else identificador)
    usuario = buscar_cuenta(con, identificador)
    if usuario is None or not usuario["activo"]:
        h.verificar(None, pin)  # mismo costo que un PIN real: no delata si la cuenta existe
        raise ReglaNegocio(PIN_INVALIDO, "pin")
    solicitud = repo.recuperacion_vigente_para_actualizar(con, usuario["id"], MAXIMO_INTENTOS)
    if solicitud is None:
        h.verificar(None, pin)
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
    repo.recuperacion_anular_pendientes(con, usuario["id"])
    repo_usuario.actualizar_hash(con, usuario["id"], h.hashear(contrasena))
    # Quien tuviera la sesión abierta con la contraseña vieja queda fuera.
    repo_sesion.borrar_todas(con, usuario["id"])
    log.info("Contraseña restablecida para el usuario id=%s.", usuario["id"])
    if usuario.get("correo") and usuario.get("correo_verificado"):
        aviso = plantillas.aviso_contrasena_cambiada(usuario["nombre_completo"], usuario["nombre_usuario"], desde_perfil=False)
        correo.enviar(aviso.para(usuario["correo"]))
