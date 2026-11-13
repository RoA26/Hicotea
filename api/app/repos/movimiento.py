from datetime import date
from decimal import Decimal

from sqlalchemy import Connection

from app.repos._sql import ejecutar, todos, uno, valor

SELECT_DETALLE = """
    SELECT m.id, m.tipo, m.fecha, m.monto, m.id_categoria, m.id_fuente, m.id_cajita,
           m.id_relacionado, m.descripcion,
           c.nombre AS nombre_categoria, c.tipo AS tipo_categoria,
           f.nombre AS nombre_fuente, cj.nombre AS nombre_cajita,
           r.id_cajita AS id_cajita_origen, cr.nombre AS nombre_cajita_origen
    FROM movimiento m
    LEFT JOIN categoria c       ON c.id = m.id_categoria
    LEFT JOIN fuente_ingreso f  ON f.id = m.id_fuente
    LEFT JOIN cajita cj         ON cj.id = m.id_cajita
    LEFT JOIN movimiento r      ON r.id_relacionado = m.id
    LEFT JOIN cajita cr         ON cr.id = r.id_cajita
"""


def insertar(con: Connection, id_usuario: int, m: dict) -> int:
    return valor(
        con,
        """INSERT INTO movimiento (id_usuario, tipo, fecha, monto, id_categoria, id_fuente,
                                   id_cajita, id_relacionado, descripcion)
           VALUES (:u, :tipo, :fecha, :monto, :id_categoria, :id_fuente, :id_cajita, :id_relacionado, :descripcion)
           RETURNING id""",
        u=id_usuario,
        tipo=str(m["tipo"]),
        fecha=m["fecha"],
        monto=m["monto"],
        id_categoria=m.get("id_categoria"),
        id_fuente=m.get("id_fuente"),
        id_cajita=m.get("id_cajita"),
        id_relacionado=m.get("id_relacionado"),
        descripcion=m.get("descripcion"),
    )


def actualizar(con: Connection, id_usuario: int, id_movimiento: int, m: dict) -> None:
    ejecutar(
        con,
        """UPDATE movimiento SET fecha = :fecha, monto = :monto, id_categoria = :id_categoria,
                                 id_fuente = :id_fuente, descripcion = :descripcion
           WHERE id = :id AND id_usuario = :u""",
        fecha=m["fecha"],
        monto=m["monto"],
        id_categoria=m["id_categoria"],
        id_fuente=m.get("id_fuente"),
        descripcion=m.get("descripcion"),
        id=id_movimiento,
        u=id_usuario,
    )


def actualizar_relacionado(con: Connection, id_usuario: int, id_origen: int, fecha: date, monto: Decimal) -> None:
    ejecutar(
        con,
        "UPDATE movimiento SET fecha = :f, monto = :m WHERE id_relacionado = :o AND id_usuario = :u",
        f=fecha,
        m=monto,
        o=id_origen,
        u=id_usuario,
    )


def eliminar(con: Connection, id_usuario: int, id_movimiento: int) -> None:
    ejecutar(con, "DELETE FROM movimiento WHERE id = :id AND id_usuario = :u", id=id_movimiento, u=id_usuario)


def buscar(con: Connection, id_usuario: int, id_movimiento: int) -> dict | None:
    return uno(con, SELECT_DETALLE + "WHERE m.id = :id AND m.id_usuario = :u", id=id_movimiento, u=id_usuario)


def buscar_relacionado(con: Connection, id_usuario: int, id_origen: int) -> dict | None:
    return uno(con, SELECT_DETALLE + "WHERE m.id_relacionado = :o AND m.id_usuario = :u", o=id_origen, u=id_usuario)


def buscar_pagina(
    con: Connection,
    id_usuario: int,
    *,
    desde: date | None,
    hasta: date | None,
    tipo: str | None,
    id_categoria: int | None,
    id_fuente: int | None,
    pagina: int,
    tamano: int,
) -> dict:
    # Los retiros que pagan un gasto no se listan aparte: se muestran como "pagado desde" en el gasto.
    condiciones = ["m.id_usuario = :u", "m.id_relacionado IS NULL"]
    params: dict = {"u": id_usuario}
    for columna, operador, nombre, v in (
        ("m.fecha", ">=", "desde", desde),
        ("m.fecha", "<=", "hasta", hasta),
        ("m.tipo", "=", "tipo", tipo),
        ("m.id_categoria", "=", "categoria", id_categoria),
        ("m.id_fuente", "=", "fuente", id_fuente),
    ):
        if v is not None:
            condiciones.append(f"{columna} {operador} :{nombre}")
            params[nombre] = v
    where = " WHERE " + " AND ".join(condiciones)
    totales = uno(
        con,
        """SELECT COUNT(*) AS registros,
                  COALESCE(SUM(m.monto) FILTER (WHERE m.tipo = 'INGRESO'), 0) AS ingresos,
                  COALESCE(SUM(m.monto) FILTER (WHERE m.tipo = 'GASTO'), 0) AS gastos
           FROM movimiento m"""
        + where,
        **params,
    )
    movimientos = todos(
        con,
        SELECT_DETALLE + where + " ORDER BY m.fecha DESC, m.id DESC LIMIT :limite OFFSET :desplazamiento",
        **params,
        limite=tamano,
        desplazamiento=pagina * tamano,
    )
    return {"movimientos": movimientos, **totales}


def ultimos(con: Connection, id_usuario: int, cantidad: int) -> list[dict]:
    return todos(
        con,
        SELECT_DETALLE + "WHERE m.id_usuario = :u AND m.id_relacionado IS NULL ORDER BY m.fecha DESC, m.id DESC LIMIT :n",
        u=id_usuario,
        n=cantidad,
    )


def listar_por_cajita(con: Connection, id_usuario: int, id_cajita: int, cantidad: int) -> list[dict]:
    return todos(
        con,
        SELECT_DETALLE + "WHERE m.id_usuario = :u AND m.id_cajita = :c ORDER BY m.fecha DESC, m.id DESC LIMIT :n",
        u=id_usuario,
        c=id_cajita,
        n=cantidad,
    )


def listar_de_cajitas(con: Connection, id_usuario: int, cantidad: int) -> list[dict]:
    return todos(
        con,
        SELECT_DETALLE + "WHERE m.id_usuario = :u AND m.id_cajita IS NOT NULL ORDER BY m.fecha DESC, m.id DESC LIMIT :n",
        u=id_usuario,
        n=cantidad,
    )


def primera_fecha_con_saldo(con: Connection, id_usuario: int, id_cajita: int, objetivo: Decimal) -> date | None:
    """Primera fecha en que el saldo acumulado de la cajita (orden fecha, id) llegó a `objetivo`.
    Solo lee: se usa para fechar un logro sin tocar movimientos."""
    return valor(
        con,
        """SELECT fecha FROM (
               SELECT fecha, SUM(CASE WHEN tipo IN ('APORTE', 'RENDIMIENTO', 'SALDO_INICIAL') THEN monto
                                      WHEN tipo = 'RETIRO' THEN -monto ELSE 0 END)
                          OVER (ORDER BY fecha, id) AS acumulado
               FROM movimiento WHERE id_usuario = :u AND id_cajita = :c
           ) t WHERE acumulado >= :obj ORDER BY fecha LIMIT 1""",
        u=id_usuario,
        c=id_cajita,
        obj=objetivo,
    )


def disponible(con: Connection, id_usuario: int) -> Decimal:
    return valor(
        con,
        """SELECT COALESCE(SUM(CASE WHEN tipo IN ('INGRESO', 'RETIRO') THEN monto
                                    WHEN tipo IN ('GASTO', 'APORTE') THEN -monto
                                    ELSE 0 END), 0)
           FROM movimiento WHERE id_usuario = :u""",
        u=id_usuario,
    )


def resumen(con: Connection, id_usuario: int, desde: date, hasta: date) -> dict:
    return uno(
        con,
        """SELECT COALESCE(SUM(m.monto) FILTER (WHERE m.tipo = 'INGRESO'), 0) AS ingresos,
                  COALESCE(SUM(m.monto) FILTER (WHERE m.tipo = 'GASTO' AND c.tipo = 'GASTO'), 0) AS personales,
                  COALESCE(SUM(m.monto) FILTER (WHERE m.tipo = 'GASTO' AND c.tipo = 'COSTO_OPERATIVO'), 0) AS costos
           FROM movimiento m
           LEFT JOIN categoria c ON c.id = m.id_categoria
           WHERE m.id_usuario = :u AND m.fecha BETWEEN :desde AND :hasta""",
        u=id_usuario,
        desde=desde,
        hasta=hasta,
    )


def totales_por_dia(con: Connection, id_usuario: int, desde: date, hasta: date) -> list[dict]:
    return todos(
        con,
        # Una sola consulta agregada por intervalo (calendario y gráficas, sin N+1).
        # Las operaciones de ahorro son flujos internos (disponible ↔ cajitas): van aparte de
        # ingresos y gastos. El retiro que paga un gasto no cuenta como operación: es parte del gasto.
        """SELECT fecha,
                  COALESCE(SUM(monto) FILTER (WHERE tipo = 'INGRESO'), 0) AS ingresos,
                  COALESCE(SUM(monto) FILTER (WHERE tipo = 'GASTO'), 0) AS gastos,
                  COALESCE(SUM(monto) FILTER (WHERE tipo = 'INGRESO' AND id_fuente IS NOT NULL), 0) AS producido,
                  COALESCE(SUM(monto) FILTER (WHERE tipo = 'APORTE'), 0) AS aportes,
                  COALESCE(SUM(monto) FILTER (WHERE tipo = 'RETIRO' AND id_relacionado IS NULL), 0) AS retiros,
                  COALESCE(SUM(monto) FILTER (WHERE tipo IN ('RENDIMIENTO', 'SALDO_INICIAL')), 0) AS rendimientos,
                  COUNT(*) FILTER (WHERE tipo NOT IN ('INGRESO', 'GASTO') AND id_relacionado IS NULL)
                      AS operaciones_ahorro,
                  COUNT(*) FILTER (WHERE id_relacionado IS NULL) AS registros
           FROM movimiento
           WHERE id_usuario = :u AND fecha BETWEEN :desde AND :hasta
           GROUP BY fecha ORDER BY fecha""",
        u=id_usuario,
        desde=desde,
        hasta=hasta,
    )


def primera_fecha(con: Connection, id_usuario: int) -> date | None:
    """Comienzo del historial financiero del usuario (fecha de su primer movimiento)."""
    return valor(con, "SELECT MIN(fecha) FROM movimiento WHERE id_usuario = :u", u=id_usuario)


def totales_por_mes(con: Connection, id_usuario: int, desde: date, hasta: date) -> list[dict]:
    return todos(
        con,
        """SELECT to_char(fecha, 'YYYY-MM') AS mes,
                  COALESCE(SUM(monto) FILTER (WHERE tipo = 'INGRESO'), 0) AS ingresos,
                  COALESCE(SUM(monto) FILTER (WHERE tipo = 'GASTO'), 0) AS gastos
           FROM movimiento
           WHERE id_usuario = :u AND tipo IN ('INGRESO', 'GASTO') AND fecha BETWEEN :desde AND :hasta
           GROUP BY 1 ORDER BY 1""",
        u=id_usuario,
        desde=desde,
        hasta=hasta,
    )


def gastos_por_categoria(con: Connection, id_usuario: int, desde: date, hasta: date) -> list[dict]:
    return todos(
        con,
        # D-F4: se agrupa por id; dos categorías con el mismo nombre (una personal y un costo) no se mezclan.
        """SELECT c.id AS id_categoria, c.nombre AS categoria, c.tipo, SUM(m.monto) AS total
           FROM movimiento m JOIN categoria c ON c.id = m.id_categoria
           WHERE m.id_usuario = :u AND m.tipo = 'GASTO' AND m.fecha BETWEEN :desde AND :hasta
           GROUP BY c.id, c.nombre, c.tipo ORDER BY total DESC, c.nombre, c.id""",
        u=id_usuario,
        desde=desde,
        hasta=hasta,
    )


def resumen_por_fuente(con: Connection, id_usuario: int, desde: date, hasta: date) -> list[dict]:
    return todos(
        con,
        # D-F4: una fuente desactivada sigue apareciendo en los periodos en que tuvo movimientos.
        """SELECT f.id AS id_fuente, f.nombre, f.activa,
                  COALESCE(SUM(m.monto) FILTER (WHERE m.tipo = 'INGRESO'), 0) AS bruto,
                  COALESCE(SUM(m.monto) FILTER (WHERE m.tipo = 'GASTO'), 0) AS costos,
                  COUNT(DISTINCT m.fecha) FILTER (WHERE m.tipo = 'INGRESO') AS dias_trabajados
           FROM fuente_ingreso f
           LEFT JOIN movimiento m ON m.id_fuente = f.id AND m.id_usuario = :u
                                 AND m.fecha BETWEEN :desde AND :hasta
           WHERE f.id_usuario = :u
           GROUP BY f.id, f.nombre, f.activa
           HAVING f.activa OR COUNT(m.id) > 0
           ORDER BY f.activa DESC, f.nombre""",
        u=id_usuario,
        desde=desde,
        hasta=hasta,
    )


def registros_del_dia(con: Connection, id_usuario: int, fecha: date) -> int:
    """Movimientos visibles de un día (sin contar el retiro que paga un gasto)."""
    return valor(
        con,
        "SELECT COUNT(*) FROM movimiento WHERE id_usuario = :u AND fecha = :f AND id_relacionado IS NULL",
        u=id_usuario,
        f=fecha,
    )
