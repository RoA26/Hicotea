from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Config(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="HICOTEA_", env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://hicotea:hicotea@localhost:5432/hicotea"

    # Código global de invitación (modo heredado). Si está definido, se sigue
    # aceptando al registrarse además de las invitaciones individuales del
    # panel. Para cerrar el registro a invitaciones individuales, déjalo vacío
    # una vez exista un administrador (docs/administracion-y-recuperacion.md).
    codigo_invitacion: str | None = Field(default=None)

    cookie_nombre: str = "hicotea_sesion"
    cookie_secure: bool = False
    sesion_dias: int = 30

    # Orígenes aceptados en peticiones que cambian estado (defensa CSRF extra a SameSite=Lax).
    origenes_permitidos: list[str] = ["http://localhost:5173"]

    # URL pública de la web, para armar los enlaces de invitación que se copian.
    url_publica: str = "http://localhost:5173"

    # Vigencia por defecto de una invitación nueva (el administrador la puede cambiar al crearla).
    invitacion_dias: int = Field(default=7, ge=1, le=30)

    # Entrega de correos (PIN de recuperación):
    #  - "ninguno": no se envía nada; el PIN queda en el log para quien administra (comportamiento previo).
    #  - "consola": el correo completo se escribe en el log (desarrollo).
    #  - "smtp":    se envía de verdad con las credenciales smtp_*.
    correo_modo: Literal["ninguno", "consola", "smtp"] = "ninguno"
    correo_remitente: str = "Hicotea <no-responder@localhost>"
    smtp_host: str | None = None
    smtp_puerto: int = 587
    smtp_usuario: str | None = None
    smtp_contrasena: str | None = None
    smtp_seguridad: Literal["starttls", "ssl", "ninguna"] = "starttls"

    @property
    def codigo_heredado(self) -> str | None:
        c = (self.codigo_invitacion or "").strip()
        return c or None


@lru_cache
def config() -> Config:
    return Config()
