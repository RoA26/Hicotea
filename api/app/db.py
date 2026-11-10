from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import Connection, Engine, create_engine

from app.config import config


@lru_cache
def motor() -> Engine:
    return create_engine(config().database_url, pool_pre_ping=True)


def conexion() -> Iterator[Connection]:
    """Dependencia: una transacción por petición. Commit si no hubo excepción,
    rollback si la hubo. Un servicio puede hacer `con.commit()` antes de lanzar
    un error cuando necesita que algo quede guardado igual (p. ej. un intento
    fallido de PIN)."""
    with motor().connect() as con:
        try:
            yield con
        except BaseException:
            con.rollback()
            raise
        else:
            con.commit()
