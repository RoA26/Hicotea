"""Administración de la plataforma (no de las finanzas de nadie).

Un administrador puede: ver cuentas (sin datos financieros), bloquear y
desbloquear, cerrar sesiones, y crear y revocar invitaciones. No puede ver ni
cambiar movimientos ajenos, consultar o fijar contraseñas, ni suplantar a
nadie: este módulo no tiene esas operaciones.

Toda acción que cambia algo queda en `auditoria_admin`. Las rechazadas por una
regla (p. ej. bloquearse a sí mismo) también: se guardan con commit antes de
responder el error, igual que los intentos fallidos de PIN."""

from sqlalchemy import Connection

from app.errores import NoEncontrado, ReglaNegocio
from app.repos import admin as repo
from app.repos import otros as repo_otros
from app.repos import sesion as repo_sesion
from app.servicios import invitaciones

TAMANO_PAGINA = 20


def _auditar(con: Connection, admin: dict, accion: str, tipo: str, recurso: dict | None, **extra) -> None:
    repo.auditar(
        con,
        id_admin=admin["id"],
        admin_nombre=admin["nombre_usuario"],
        accion=accion,
        recurso_tipo=tipo,
        recurso_id=recurso and recurso.get("id"),
        recurso_nombre=recurso and (recurso.get("nombre_usuario") or recurso.get("nota") or recurso.get("correo")),
        **extra,
    )


def _rechazar(con: Connection, admin: dict, accion: str, tipo: str, recurso: dict | None, mensaje: str) -> None:
    """Deja constancia del intento rechazado (commit) y responde 409."""
    con.rollback()
    _auditar(con, admin, accion, tipo, recurso, resultado="RECHAZADO", detalle=mensaje)
    con.commit()
    raise ReglaNegocio(mensaje, estado=409)


def _pagina(filas: list[dict], total: int, pagina: int) -> dict:
    return {
        "elementos": filas,
        "pagina": pagina,
        "total": total,
        "hay_anterior": pagina > 0,
        "hay_siguiente": (pagina + 1) * TAMANO_PAGINA < total,
    }


# ====================================================================== resumen


def resumen(con: Connection) -> dict:
    auditoria, _ = repo.auditoria_listar(con, 8, 0)
    return {
        "cuentas": repo.cuentas_conteo(con),
        "invitaciones": repo.invitaciones_por_estado(con),
        "actividad_reciente": auditoria,
    }


# ====================================================================== cuentas


def cuentas(con: Connection, busqueda: str | None, estado: str | None, rol: str | None, pagina: int) -> dict:
    q = (busqueda or "").strip()[:60] or None
    filas, total = repo.cuentas_listar(con, q, estado, rol, TAMANO_PAGINA, pagina * TAMANO_PAGINA)
    return _pagina(filas, total, pagina)


def _cuenta(con: Connection, id_usuario: int) -> dict:
    c = repo.cuenta_por_id(con, id_usuario)
    if c is None:
        raise NoEncontrado("Cuenta no encontrada")
    return c


def bloquear(con: Connection, admin: dict, id_usuario: int) -> dict:
    repo.bloquear_administracion(con)
    c = _cuenta(con, id_usuario)
    if c["id"] == admin["id"]:
        _rechazar(con, admin, "BLOQUEAR_CUENTA", "USUARIO", c, "No puedes bloquear tu propia cuenta.")
    if not c["activo"]:
        return c  # idempotente
    if c["rol"] == "ADMIN" and repo.admins_activos(con, excluir=c["id"]) == 0:
        _rechazar(con, admin, "BLOQUEAR_CUENTA", "USUARIO", c, "Es el único administrador activo.")
    repo.cuenta_bloquear(con, c["id"])
    sesiones = repo_sesion.borrar_todas(con, c["id"])
    repo_otros.recuperacion_anular_pendientes(con, c["id"])
    _auditar(con, admin, "BLOQUEAR_CUENTA", "USUARIO", c, detalle=f"Sesiones cerradas: {sesiones}")
    return repo.cuenta_por_id(con, c["id"])


def desbloquear(con: Connection, admin: dict, id_usuario: int) -> dict:
    repo.bloquear_administracion(con)
    c = _cuenta(con, id_usuario)
    if c["activo"]:
        return c
    repo.cuenta_desbloquear(con, c["id"])
    _auditar(con, admin, "DESBLOQUEAR_CUENTA", "USUARIO", c)
    return repo.cuenta_por_id(con, c["id"])


def cerrar_sesiones(con: Connection, admin: dict, id_usuario: int) -> dict:
    c = _cuenta(con, id_usuario)
    if c["id"] == admin["id"]:
        _rechazar(con, admin, "CERRAR_SESIONES", "USUARIO", c, "Para cerrar tu propia sesión usa «Cerrar sesión».")
    n = repo_sesion.borrar_todas(con, c["id"])
    _auditar(con, admin, "CERRAR_SESIONES", "USUARIO", c, detalle=f"Sesiones cerradas: {n}")
    return repo.cuenta_por_id(con, c["id"])


# ====================================================================== invitaciones


def invitaciones_listar(con: Connection, estado: str | None, pagina: int) -> dict:
    filas, total = repo.invitaciones_listar(con, estado, TAMANO_PAGINA, pagina * TAMANO_PAGINA)
    return _pagina(filas, total, pagina)


def invitacion_crear(con: Connection, admin: dict, dias: int, correo: str | None, nota: str | None) -> dict:
    inv, token = invitaciones.crear(con, admin["id"], dias, (correo or "").strip().lower() or None, nota)
    _auditar(con, admin, "CREAR_INVITACION", "INVITACION", inv, detalle=f"Vigencia: {dias} días")
    # El enlace (con el token en claro) solo viaja en esta respuesta.
    return {**inv, "enlace": invitaciones.enlace(token)}


def invitacion_revocar(con: Connection, admin: dict, id_inv: int) -> dict:
    inv = repo.invitacion_por_id(con, id_inv)
    if inv is None:
        raise NoEncontrado("Invitación no encontrada")
    if repo.invitacion_revocar(con, id_inv, admin["id"]) == 0:
        _rechazar(con, admin, "REVOCAR_INVITACION", "INVITACION", inv,
                  "Solo se pueden revocar invitaciones pendientes.")
    _auditar(con, admin, "REVOCAR_INVITACION", "INVITACION", inv)
    return repo.invitacion_por_id(con, id_inv)


# ====================================================================== auditoría


def auditoria(con: Connection, pagina: int) -> dict:
    filas, total = repo.auditoria_listar(con, TAMANO_PAGINA, pagina * TAMANO_PAGINA)
    return _pagina(filas, total, pagina)
