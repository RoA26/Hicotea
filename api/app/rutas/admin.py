"""/api/admin: gestión de la plataforma. Todas las rutas exigen AdminActual
(403 para cualquier otra cuenta) y ninguna devuelve datos financieros."""

from typing import Literal

from fastapi import APIRouter, Query, status

from app.esquemas.admin import (
    CuentaAdmin,
    InvitacionAdmin,
    InvitacionCreada,
    InvitacionForm,
    PaginaAuditoria,
    PaginaCuentas,
    PaginaInvitaciones,
    ResumenAdmin,
)
from app.seguridad.dependencias import AdminActual, Con
from app.servicios import admin as servicio

router = APIRouter(prefix="/api/admin", tags=["administración"])

Pagina = Query(default=0, ge=0, le=10_000)


@router.get("/resumen", response_model=ResumenAdmin)
def resumen(_: AdminActual, con: Con):
    return servicio.resumen(con)


@router.get("/usuarios", response_model=PaginaCuentas)
def usuarios(
    _: AdminActual,
    con: Con,
    q: str | None = Query(default=None, max_length=60),
    estado: Literal["ACTIVA", "BLOQUEADA"] | None = None,
    rol: Literal["USUARIO", "ADMIN"] | None = None,
    pagina: int = Pagina,
):
    return servicio.cuentas(con, q, estado, rol, pagina)


@router.post("/usuarios/{id_usuario}/bloquear", response_model=CuentaAdmin)
def bloquear(id_usuario: int, admin: AdminActual, con: Con):
    return servicio.bloquear(con, admin, id_usuario)


@router.post("/usuarios/{id_usuario}/desbloquear", response_model=CuentaAdmin)
def desbloquear(id_usuario: int, admin: AdminActual, con: Con):
    return servicio.desbloquear(con, admin, id_usuario)


@router.post("/usuarios/{id_usuario}/cerrar-sesiones", response_model=CuentaAdmin)
def cerrar_sesiones(id_usuario: int, admin: AdminActual, con: Con):
    return servicio.cerrar_sesiones(con, admin, id_usuario)


@router.get("/invitaciones", response_model=PaginaInvitaciones)
def invitaciones(
    _: AdminActual,
    con: Con,
    estado: Literal["PENDIENTE", "USADA", "EXPIRADA", "REVOCADA"] | None = None,
    pagina: int = Pagina,
):
    return servicio.invitaciones_listar(con, estado, pagina)


@router.post("/invitaciones", response_model=InvitacionCreada, status_code=status.HTTP_201_CREATED)
def crear_invitacion(form: InvitacionForm, admin: AdminActual, con: Con):
    return servicio.invitacion_crear(con, admin, form.dias, form.correo, form.nota)


@router.post("/invitaciones/{id_invitacion}/revocar", response_model=InvitacionAdmin)
def revocar_invitacion(id_invitacion: int, admin: AdminActual, con: Con):
    return servicio.invitacion_revocar(con, admin, id_invitacion)


@router.get("/auditoria", response_model=PaginaAuditoria)
def auditoria(_: AdminActual, con: Con, pagina: int = Pagina):
    return servicio.auditoria(con, pagina)
