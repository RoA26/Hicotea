from decimal import Decimal

from sqlalchemy import Connection

from app.repos._sql import EXCLUIDO, ejecutar, todos, uno, valor

# Saldo = aportes + rendimientos + saldo inicial - retiros (RN-06). Nunca se guarda: se calcula.
EXPRESION_SALDO = """COALESCE(SUM(CASE WHEN m.tipo IN ('APORTE', 'RENDIMIENTO', 'SALDO_INICIAL') THEN m.monto
                                  WHEN m.tipo = 'RETIRO' THEN -m.monto
                                  ELSE 0 END), 0)"""

_SELECT_CON_SALDO = f"""
    SELECT c.id, c.nombre, c.descripcion, c.proposito, c.porcentaje, c.es_resto, c.activa, {EXPRESION_SALDO} AS saldo
    FROM cajita c
    LEFT JOIN movimiento m ON m.id_cajita = c.id
"""


def listar(con: Connection, id_usuario: int) -> list[dict]:
    return todos(
        con,
        _SELECT_CON_SALDO
        + "WHERE c.id_usuario = :u GROUP BY c.id ORDER BY c.activa DESC, c.es_resto, c.porcentaje DESC, c.nombre",
        u=id_usuario,
    )


def buscar(con: Connection, id_usuario: int, id_cajita: int) -> dict | None:
    return uno(con, _SELECT_CON_SALDO + "WHERE c.id = :id AND c.id_usuario = :u GROUP BY c.id", id=id_cajita, u=id_usuario)


def insertar(
    con: Connection, id_usuario: int, nombre: str, proposito: str, porcentaje: Decimal, es_resto: bool,
    descripcion: str | None = None,
) -> int:
    return valor(
        con,
        """INSERT INTO cajita (id_usuario, nombre, proposito, porcentaje, es_resto, descripcion)
           VALUES (:u, :n, :p, :pct, :r, :d) RETURNING id""",
        u=id_usuario,
        d=descripcion,
        n=nombre,
        p=proposito,
        pct=porcentaje,
        r=es_resto,
    )


def actualizar(
    con: Connection, id_usuario: int, id_cajita: int, nombre: str, proposito: str, porcentaje: Decimal, es_resto: bool,
    descripcion: str | None = None,
) -> None:
    ejecutar(
        con,
        """UPDATE cajita SET nombre = :n, proposito = :p, porcentaje = :pct, es_resto = :r, descripcion = :d
           WHERE id = :id AND id_usuario = :u""",
        d=descripcion,
        n=nombre,
        p=proposito,
        pct=porcentaje,
        r=es_resto,
        id=id_cajita,
        u=id_usuario,
    )


def cambiar_estado(con: Connection, id_usuario: int, id_cajita: int, activa: bool) -> None:
    ejecutar(con, "UPDATE cajita SET activa = :a WHERE id = :id AND id_usuario = :u", a=activa, id=id_cajita, u=id_usuario)


def desmarcar_resto(con: Connection, id_usuario: int, excluido: int | None) -> None:
    ejecutar(
        con, f"UPDATE cajita SET es_resto = FALSE WHERE id_usuario = :u AND id <> {EXCLUIDO}", u=id_usuario, excluido=excluido
    )


def existe_nombre(con: Connection, id_usuario: int, nombre: str, excluido: int | None) -> bool:
    return valor(
        con,
        f"""SELECT EXISTS (SELECT 1 FROM cajita
                          WHERE id_usuario = :u AND lower(nombre) = lower(:n) AND id <> {EXCLUIDO})""",
        u=id_usuario,
        n=nombre,
        excluido=excluido,
    )


def saldo(con: Connection, id_usuario: int, id_cajita: int) -> Decimal:
    return valor(
        con,
        f"SELECT {EXPRESION_SALDO} FROM movimiento m WHERE m.id_usuario = :u AND m.id_cajita = :c",
        u=id_usuario,
        c=id_cajita,
    )
