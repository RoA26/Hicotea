"""Perfil de la cuenta propia: datos, correo verificado, contraseña y sesiones.

Reglas de seguridad (ver docs/perfil-y-verificacion-correo.md):
- Cambiar el correo o la contraseña exige la contraseña actual (reautenticación),
  aunque la sesión esté abierta: protege una sesión olvidada en otro equipo.
- Una dirección nueva queda **pendiente** hasta abrir el enlace enviado a ella;
  mientras tanto la actual (si hay) sigue en uso y la nueva no recibe el PIN.
- La respuesta al pedir un enlace es la misma esté o no la dirección en uso
  por otra cuenta: no sirve para averiguar qué correos están registrados.
- Nunca se devuelven hashes, tokens ni PIN.
"""

import logging

from sqlalchemy import Connection
from sqlalchemy.exc import IntegrityError

from app import correo
from app import plantillas_correo as plantillas
from app.errores import ReglaNegocio
from app.repos import otros as repo_otros
from app.repos import sesion as repo_sesion
from app.repos import usuario as repo_usuario
from app.repos import verificacion as repo_verificacion
from app.seguridad import hash as h
from app.seguridad.sesion import hash_token
from app.servicios import verificacion
from app.servicios.auth import normalizar_correo, validar_contrasena

log = logging.getLogger("hicotea")

SEGUNDOS_ENTRE_ENLACES = 60
CONTRASENA_INCORRECTA = "La contraseña actual no es correcta."
CORREO_NO_CONFIGURADO = (
    "Este servidor todavía no puede enviar correos, así que no podemos verificar direcciones. "
    "Avísale a quien administra Hicotea."
)
ENLACE_INVALIDO = "El enlace no es válido, ya se usó o venció. Pide uno nuevo desde tu perfil."


class ContrasenaIncorrecta(ReglaNegocio):
    def __init__(self) -> None:
        super().__init__(CONTRASENA_INCORRECTA, "contrasena_actual")


def _exigir_contrasena(con: Connection, id_usuario: int, contrasena: str) -> None:
    if not h.verificar(repo_usuario.hash_contrasena(con, id_usuario), contrasena):
        raise ContrasenaIncorrecta()


# ====================================================================== perfil


def perfil(con: Connection, id_usuario: int) -> dict:
    u = repo_usuario.por_id(con, id_usuario)
    pendiente = repo_verificacion.pendiente(con, id_usuario)
    return {
        **u,
        "correo_pendiente": pendiente["correo"] if pendiente else None,
        "correo_pendiente_expira_en": pendiente["expira_en"] if pendiente else None,
        "correo_disponible": correo.disponible(),
        "sesiones_activas": repo_sesion.contar_activas(con, id_usuario),
    }


def actualizar_datos(con: Connection, id_usuario: int, nombre_completo: str) -> dict:
    nombre = " ".join(nombre_completo.split())
    if not nombre:
        raise ReglaNegocio("Escribe tu nombre.", "nombre_completo")
    repo_usuario.actualizar_nombre(con, id_usuario, nombre)
    return perfil(con, id_usuario)


# ====================================================================== correo


def solicitar_correo(con: Connection, usuario: dict, direccion: str, contrasena: str) -> str:
    """Envía un enlace de verificación a `direccion` (nueva, o la actual sin verificar)."""
    _exigir_contrasena(con, usuario["id"], contrasena)
    nueva = normalizar_correo(direccion)
    if nueva is None:
        raise ReglaNegocio("Escribe un correo.", "correo")
    actual = normalizar_correo(usuario.get("correo"))
    if nueva == actual and usuario.get("correo_verificado"):
        raise ReglaNegocio("Ese ya es tu correo verificado.", "correo")
    if not correo.disponible():
        raise ReglaNegocio(CORREO_NO_CONFIGURADO, estado=503, codigo="CORREO_NO_CONFIGURADO")
    if repo_verificacion.reciente(con, usuario["id"], SEGUNDOS_ENTRE_ENLACES):
        raise ReglaNegocio("Acabamos de enviarte un enlace. Espera un minuto antes de pedir otro.", estado=429)

    mensaje = (
        f"Te enviamos un enlace a {nueva}. Ábrelo en las próximas {verificacion.HORAS_VIGENCIA} horas "
        "para confirmar la dirección. Si no llega, revisa que esté bien escrita y pide otro."
    )
    if repo_usuario.correo_verificado_de_otra_cuenta(con, nueva, usuario["id"]):
        # Misma respuesta que si estuviera libre (sin enumeración); no se envía nada,
        # pero se anulan los enlaces previos igual que en el caso normal.
        repo_verificacion.anular_pendientes(con, usuario["id"])
        log.info("Verificación pedida por el usuario id=%s para un correo ya verificado en otra cuenta.", usuario["id"])
        return mensaje
    if not verificacion.enviar_enlace(con, usuario, nueva):
        raise ReglaNegocio("No pudimos enviar el correo. Intenta de nuevo en unos minutos.", estado=503)
    return mensaje


def cancelar_pendiente(con: Connection, id_usuario: int) -> None:
    repo_verificacion.anular_pendientes(con, id_usuario)


def verificar(con: Connection, token: str) -> dict:
    """Consume el enlace y deja la dirección como correo verificado de la cuenta."""
    token = (token or "").strip()
    fila = repo_verificacion.consumir(con, hash_token(token)) if token else None
    if fila is None:
        raise ReglaNegocio(ENLACE_INVALIDO, "token")
    u = repo_usuario.por_id(con, fila["id_usuario"])
    if u is None or not u["activo"]:
        raise ReglaNegocio(ENLACE_INVALIDO, "token")
    direccion = fila["correo"]
    anterior = u["correo"] if u["correo_verificado"] else None
    if repo_usuario.correo_verificado_de_otra_cuenta(con, direccion, u["id"]):
        # Otra cuenta la verificó mientras tanto. El enlace queda gastado (commit).
        con.commit()
        raise ReglaNegocio("Esa dirección ya está en uso en otra cuenta.", "token", estado=409)
    try:
        with con.begin_nested():
            repo_usuario.fijar_correo_verificado(con, u["id"], direccion)
    except IntegrityError as e:  # verificación simultánea en otra cuenta
        raise ReglaNegocio("Esa dirección ya está en uso en otra cuenta.", "token", estado=409) from e
    repo_verificacion.anular_pendientes(con, u["id"])
    # Un PIN pedido antes pudo ir a la dirección anterior: deja de valer.
    repo_otros.recuperacion_anular_pendientes(con, u["id"])
    log.info("Correo verificado para el usuario id=%s.", u["id"])
    if anterior and anterior.lower() != direccion.lower():
        correo.enviar(plantillas.aviso_correo_cambiado(u["nombre_completo"], u["nombre_usuario"], direccion).para(anterior))
    return {"mensaje": f"Listo. {direccion} quedó verificado en tu cuenta.", "correo": direccion}


# ====================================================================== contraseña y sesiones


def cambiar_contrasena(
    con: Connection, usuario: dict, actual: str, nueva: str, confirmacion: str, token_hash_actual: str
) -> int:
    """Cambia la contraseña y cierra las demás sesiones. Devuelve cuántas cerró."""
    _exigir_contrasena(con, usuario["id"], actual)
    validar_contrasena(nueva, confirmacion, usuario["nombre_usuario"])
    if nueva == actual:
        raise ReglaNegocio("La contraseña nueva debe ser distinta de la actual.", "contrasena")
    repo_usuario.actualizar_hash(con, usuario["id"], h.hashear(nueva))
    cerradas = repo_sesion.borrar_otras(con, usuario["id"], token_hash_actual)
    repo_otros.recuperacion_anular_pendientes(con, usuario["id"])
    log.info("Contraseña cambiada desde el perfil por el usuario id=%s.", usuario["id"])
    if usuario.get("correo") and usuario.get("correo_verificado"):
        aviso = plantillas.aviso_contrasena_cambiada(usuario["nombre_completo"], usuario["nombre_usuario"], desde_perfil=True)
        correo.enviar(aviso.para(usuario["correo"]))
    return cerradas


def cerrar_otras_sesiones(con: Connection, id_usuario: int, token_hash_actual: str) -> int:
    return repo_sesion.borrar_otras(con, id_usuario, token_hash_actual)
