from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import Connection, Engine, create_engine

from app.config import config


@lru_cache
def motor() -> Engine:
    return create_engine(config().database_url, pool_pre_ping=True)


def conexion() -> Iterator[Connection]:
    """Dependencia: una transacción por petición; commit si no hubo excepción."""
    with motor().begin() as con:
        yield con
