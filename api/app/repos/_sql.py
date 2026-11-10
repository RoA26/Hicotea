"""Atajos para ejecutar SQL explícito y recibir dicts."""

from typing import Any

from sqlalchemy import Connection, text


def uno(con: Connection, sql: str, **params: Any) -> dict | None:
    fila = con.execute(text(sql), params).mappings().first()
    return dict(fila) if fila else None


def todos(con: Connection, sql: str, **params: Any) -> list[dict]:
    return [dict(f) for f in con.execute(text(sql), params).mappings()]


def valor(con: Connection, sql: str, **params: Any) -> Any:
    return con.execute(text(sql), params).scalar_one()


def ejecutar(con: Connection, sql: str, **params: Any) -> int:
    """Devuelve el número de filas afectadas."""
    return con.execute(text(sql), params).rowcount


# Para "excluir este id" cuando puede ser None, sin que PostgreSQL dude del tipo del parámetro.
EXCLUIDO = "COALESCE(CAST(:excluido AS BIGINT), -1)"
