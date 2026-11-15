"""Esquemas del panel de administración. Ninguno incluye datos financieros,
contraseñas, hashes ni tokens (salvo el enlace de una invitación recién creada)."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.esquemas.auth import PATRON_CORREO

EstadoInvitacion = Literal["PENDIENTE", "USADA", "EXPIRADA", "REVOCADA"]


class ConteoCuentas(BaseModel):
    total: int
    activas: int
    bloqueadas: int
    administradores: int


class ConteoInvitaciones(BaseModel):
    PENDIENTE: int
    USADA: int
    EXPIRADA: int
    REVOCADA: int


class EventoAuditoria(BaseModel):
    id: int
    fecha: datetime
    admin_nombre: str
    accion: str
    recurso_tipo: str
    recurso_id: int | None
    recurso_nombre: str | None
    resultado: Literal["EXITO", "RECHAZADO"]
    detalle: str | None


class ResumenAdmin(BaseModel):
    cuentas: ConteoCuentas
    invitaciones: ConteoInvitaciones
    actividad_reciente: list[EventoAuditoria]


class CuentaAdmin(BaseModel):
    id: int
    nombre_usuario: str
    nombre_completo: str
    correo: str | None
    correo_verificado: bool = False
    rol: Literal["USUARIO", "ADMIN"]
    activo: bool
    bloqueado_en: datetime | None
    fecha_registro: datetime
    ultimo_ingreso_en: datetime | None
    sesiones_activas: int


class InvitacionAdmin(BaseModel):
    id: int
    correo: str | None
    nota: str | None
    estado: EstadoInvitacion
    creada_en: datetime
    expira_en: datetime
    usada_en: datetime | None
    revocada_en: datetime | None
    creada_por: str | None
    usada_por: str | None
    revocada_por: str | None


class InvitacionCreada(InvitacionAdmin):
    # Solo en la respuesta de creación: no se puede volver a consultar.
    enlace: str


class InvitacionForm(BaseModel):
    dias: int = Field(default=7, ge=1, le=30)
    correo: str | None = Field(default=None, max_length=254, pattern=PATRON_CORREO)
    nota: str | None = Field(default=None, max_length=100)

    @field_validator("correo", "nota", mode="before")
    @classmethod
    def _vacio(cls, v):
        return None if isinstance(v, str) and not v.strip() else v


class _Pagina(BaseModel):
    pagina: int
    total: int
    hay_anterior: bool
    hay_siguiente: bool


class PaginaCuentas(_Pagina):
    elementos: list[CuentaAdmin]


class PaginaInvitaciones(_Pagina):
    elementos: list[InvitacionAdmin]


class PaginaAuditoria(_Pagina):
    elementos: list[EventoAuditoria]
