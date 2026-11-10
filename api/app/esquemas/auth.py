from datetime import datetime

from pydantic import BaseModel, Field


class RegistroForm(BaseModel):
    nombre_usuario: str = Field(min_length=3, max_length=30, pattern=r"^\s*[a-zA-Z0-9_.-]+\s*$")
    nombre_completo: str = Field(min_length=1, max_length=100)
    contrasena: str = Field(min_length=8, max_length=128)
    confirmacion_contrasena: str = Field(max_length=128)
    codigo_invitacion: str = Field(max_length=200)


class LoginForm(BaseModel):
    nombre_usuario: str = Field(max_length=30)
    contrasena: str = Field(max_length=128)


class RecuperarForm(BaseModel):
    nombre_usuario: str = Field(max_length=30)


class RestablecerForm(BaseModel):
    nombre_usuario: str = Field(max_length=30)
    pin: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")
    contrasena: str = Field(min_length=8, max_length=128)
    confirmacion_contrasena: str = Field(max_length=128)


class UsuarioOut(BaseModel):
    id: int
    nombre_usuario: str
    nombre_completo: str
    fecha_registro: datetime
