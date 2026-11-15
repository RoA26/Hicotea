from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

# Validación básica de forma; la entrega real del correo es la verdadera prueba.
PATRON_CORREO = r"^\s*[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}\s*$"


class RegistroForm(BaseModel):
    nombre_usuario: str = Field(min_length=3, max_length=30, pattern=r"^\s*[a-zA-Z0-9_.-]+\s*$")
    nombre_completo: str = Field(min_length=1, max_length=100)
    contrasena: str = Field(min_length=8, max_length=128)
    confirmacion_contrasena: str = Field(max_length=128)
    # Token de una invitación individual o, si sigue configurado, el código global heredado.
    codigo_invitacion: str = Field(max_length=200)
    # Opcional: permite recibir el PIN de recuperación por correo.
    correo: str | None = Field(default=None, max_length=254, pattern=PATRON_CORREO)

    @field_validator("correo", mode="before")
    @classmethod
    def _correo_vacio(cls, v):
        return None if isinstance(v, str) and not v.strip() else v


class LoginForm(BaseModel):
    nombre_usuario: str = Field(max_length=30)
    contrasena: str = Field(max_length=128)


class RecuperarForm(BaseModel):
    # Nombre de usuario o correo electrónico.
    nombre_usuario: str = Field(min_length=1, max_length=254)


class RestablecerForm(BaseModel):
    nombre_usuario: str = Field(min_length=1, max_length=254)
    pin: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")
    contrasena: str = Field(min_length=8, max_length=128)
    confirmacion_contrasena: str = Field(max_length=128)


class InvitacionConsulta(BaseModel):
    token: str = Field(max_length=200)


class InvitacionEstado(BaseModel):
    valida: bool
    correo: str | None = None


class UsuarioOut(BaseModel):
    id: int
    nombre_usuario: str
    nombre_completo: str
    correo: str | None = None
    rol: Literal["USUARIO", "ADMIN"] = "USUARIO"
    fecha_registro: datetime
