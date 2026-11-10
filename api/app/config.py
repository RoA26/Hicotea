from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Config(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="HICOTEA_", env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://hicotea:hicotea@localhost:5432/hicotea"

    # Obligatorio: sin él la app no arranca. Se pide al registrarse (cuentas solo por invitación).
    codigo_invitacion: str = Field(min_length=1)

    cookie_nombre: str = "hicotea_sesion"
    cookie_secure: bool = False
    sesion_dias: int = 30

    # Orígenes aceptados en peticiones que cambian estado (defensa CSRF extra a SameSite=Lax).
    origenes_permitidos: list[str] = ["http://localhost:5173"]


@lru_cache
def config() -> Config:
    return Config()
