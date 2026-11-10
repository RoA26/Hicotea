"""Repositorios pequeños: recurrentes, presupuestos, metas, acceso compartido,
atajos y recuperación de contraseña."""

from datetime import date
from decimal import Decimal

from sqlalchemy import Connection

from app.repos._sql import EXCLUIDO, ejecutar, todos, uno, valor
from app.repos.cajita import EXPRESION_SALDO


def _existe_nombre(con: Connection, tabla: str, id_usuario: int, nombre: str, excluido: int | None) -> bool:
    return valor(
        con,
        f"""SELECT EXISTS (SELECT 1 FROM {tabla}
                          WHERE id_usuario = :u AND lower(nombre) = lower(:n) AND id <> {EXCLUIDO})""",
        u=id_usuario,
        n=nombre,
        excluido=excluido,
    )


# ====================================================================== recurrentes

_SELECT_RECURRENTE = """
    SELECT r.id, r.nombre, r.tipo, r.monto, r.id_categoria, r.id_fuente, r.id_cajita_origen,
           r.periodicidad, r.dia_ancla, r.proxima_fecha, r.dias_aviso, r.activo,
           c.nombre AS nombre_categoria, f.nombre AS nombre_fuente, cj.nombre AS nombre_cajita_origen
    FROM recurrente r
    JOIN categoria c           ON c.id = r.id_categoria
    LEFT JOIN fuente_ingreso f ON f.id = r.id_fuente
    LEFT JOIN cajita cj        ON cj.id = r.id_cajita_origen
"""

_CAMPOS_RECURRENTE = dict.fromkeys(
    ("nombre", "tipo", "monto", "id_categoria", "id_fuente", "id_cajita_origen", "periodicidad",
     "dia_ancla", "proxima_fecha", "dias_aviso")
)


def _params_recurrente(r: dict) -> dict:
    return {k: (str(r[k]) if k in ("tipo", "periodicidad") else r[k]) for k in _CAMPOS_RECURRENTE}


def recurrente_insertar(con: Connection, id_usuario: int, r: dict) -> int:
    return valor(
        con,
        """INSERT INTO recurrente (id_usuario, nombre, tipo, monto, id_categoria, id_fuente, id_cajita_origen,
                                   periodicidad, dia_ancla, proxima_fecha, dias_aviso)
           VALUES (:u, :nombre, :tipo, :monto, :id_categoria, :id_fuente, :id_cajita_origen,
                   :periodicidad, :dia_ancla, :proxima_fecha, :dias_aviso)
           RETURNING id""",
        u=id_usuario,
        **_params_recurrente(r),
    )


def recurrente_actualizar(con: Connection, id_usuario: int, id_recurrente: int, r: dict) -> None:
    ejecutar(
        con,
        """UPDATE recurrente SET nombre = :nombre, tipo = :tipo, monto = :monto, id_categoria = :id_categoria,
                  id_fuente = :id_fuente, id_cajita_origen = :id_cajita_origen, periodicidad = :periodicidad,
                  dia_ancla = :dia_ancla, proxima_fecha = :proxima_fecha, dias_aviso = :dias_aviso
           WHERE id = :id AND id_usuario = :u""",
        id=id_recurrente,
        u=id_usuario,
        **_params_recurrente(r),
    )


def recurrente_actualizar_proxima(con: Connection, id_usuario: int, id_recurrente: int, proxima: date) -> None:
    ejecutar(
        con, "UPDATE recurrente SET proxima_fecha = :p WHERE id = :id AND id_usuario = :u", p=proxima, id=id_recurrente, u=id_usuario
    )


def recurrente_cambiar_estado(con: Connection, id_usuario: int, id_recurrente: int, activo: bool) -> None:
    ejecutar(con, "UPDATE recurrente SET activo = :a WHERE id = :id AND id_usuario = :u", a=activo, id=id_recurrente, u=id_usuario)


def recurrente_eliminar(con: Connection, id_usuario: int, id_recurrente: int) -> None:
    ejecutar(con, "DELETE FROM recurrente WHERE id = :id AND id_usuario = :u", id=id_recurrente, u=id_usuario)


def recurrente_buscar(con: Connection, id_usuario: int, id_recurrente: int) -> dict | None:
    return uno(con, _SELECT_RECURRENTE + "WHERE r.id = :id AND r.id_usuario = :u", id=id_recurrente, u=id_usuario)


def recurrente_listar(con: Connection, id_usuario: int) -> list[dict]:
    return todos(con, _SELECT_RECURRENTE + "WHERE r.id_usuario = :u ORDER BY r.activo DESC, r.proxima_fecha, r.nombre", u=id_usuario)


def recurrente_pendientes(con: Connection, id_usuario: int, hoy: date) -> list[dict]:
    return todos(
        con,
        _SELECT_RECURRENTE
        + "WHERE r.id_usuario = :u AND r.activo AND r.proxima_fecha - r.dias_aviso <= :hoy ORDER BY r.proxima_fecha, r.nombre",
        u=id_usuario,
        hoy=hoy,
    )


def recurrente_existe_nombre(con: Connection, id_usuario: int, nombre: str, excluido: int | None) -> bool:
    return _existe_nombre(con, "recurrente", id_usuario, nombre, excluido)


# ====================================================================== presupuestos


def presupuesto_guardar(con: Connection, id_usuario: int, id_categoria: int, monto: Decimal) -> int:
    return valor(
        con,
        """INSERT INTO presupuesto (id_usuario, id_categoria, monto_mensual) VALUES (:u, :c, :m)
           ON CONFLICT (id_usuario, id_categoria) DO UPDATE SET monto_mensual = EXCLUDED.monto_mensual
           RETURNING id""",
        u=id_usuario,
        c=id_categoria,
        m=monto,
    )


def presupuesto_eliminar(con: Connection, id_usuario: int, id_presupuesto: int) -> int:
    return ejecutar(con, "DELETE FROM presupuesto WHERE id = :id AND id_usuario = :u", id=id_presupuesto, u=id_usuario)


def presupuesto_listar_con_gastado(con: Connection, id_usuario: int, desde: date, hasta: date) -> list[dict]:
    return todos(
        con,
        """SELECT p.id, p.id_categoria, c.nombre AS categoria, c.tipo AS tipo_categoria,
                  p.monto_mensual AS presupuestado, COALESCE(SUM(m.monto), 0) AS gastado
           FROM presupuesto p
           JOIN categoria c ON c.id = p.id_categoria
           LEFT JOIN movimiento m ON m.id_categoria = p.id_categoria AND m.tipo = 'GASTO'
                                 AND m.fecha BETWEEN :desde AND :hasta
           WHERE p.id_usuario = :u
           GROUP BY p.id, c.nombre, c.tipo
           ORDER BY c.tipo, c.nombre""",
        u=id_usuario,
        desde=desde,
        hasta=hasta,
    )


# ====================================================================== metas

_SELECT_META = f"""
    SELECT mt.id, mt.nombre, mt.monto_objetivo, mt.fecha_objetivo, mt.id_cajita, mt.activa,
           c.nombre AS nombre_cajita, {EXPRESION_SALDO} AS saldo_cajita
    FROM meta mt
    JOIN cajita c ON c.id = mt.id_cajita
    LEFT JOIN movimiento m ON m.id_cajita = c.id
"""


def meta_insertar(con: Connection, id_usuario: int, m: dict) -> int:
    return valor(
        con,
        """INSERT INTO meta (id_usuario, nombre, monto_objetivo, fecha_objetivo, id_cajita)
           VALUES (:u, :nombre, :monto_objetivo, :fecha_objetivo, :id_cajita) RETURNING id""",
        u=id_usuario,
        **m,
    )


def meta_actualizar(con: Connection, id_usuario: int, id_meta: int, m: dict) -> None:
    ejecutar(
        con,
        """UPDATE meta SET nombre = :nombre, monto_objetivo = :monto_objetivo, fecha_objetivo = :fecha_objetivo,
                           id_cajita = :id_cajita
           WHERE id = :id AND id_usuario = :u""",
        id=id_meta,
        u=id_usuario,
        **m,
    )


def meta_cambiar_estado(con: Connection, id_usuario: int, id_meta: int, activa: bool) -> None:
    ejecutar(con, "UPDATE meta SET activa = :a WHERE id = :id AND id_usuario = :u", a=activa, id=id_meta, u=id_usuario)


def meta_eliminar(con: Connection, id_usuario: int, id_meta: int) -> None:
    ejecutar(con, "DELETE FROM meta WHERE id = :id AND id_usuario = :u", id=id_meta, u=id_usuario)


def meta_buscar(con: Connection, id_usuario: int, id_meta: int) -> dict | None:
    return uno(con, _SELECT_META + "WHERE mt.id = :id AND mt.id_usuario = :u GROUP BY mt.id, c.nombre", id=id_meta, u=id_usuario)


def meta_listar(con: Connection, id_usuario: int) -> list[dict]:
    return todos(
        con,
        _SELECT_META
        + "WHERE mt.id_usuario = :u GROUP BY mt.id, c.nombre ORDER BY mt.activa DESC, mt.fecha_objetivo NULLS LAST, mt.nombre",
        u=id_usuario,
    )


def meta_existe_nombre(con: Connection, id_usuario: int, nombre: str, excluido: int | None) -> bool:
    return _existe_nombre(con, "meta", id_usuario, nombre, excluido)


# ====================================================================== acceso compartido

_SELECT_ACCESO = """
    SELECT a.id, a.id_titular, t.nombre_completo AS nombre_completo_titular,
           a.id_invitado, i.nombre_usuario AS nombre_usuario_invitado, i.nombre_completo AS nombre_completo_invitado,
           (a.fecha_concesion AT TIME ZONE 'America/Bogota')::date AS fecha_concesion
    FROM acceso_compartido a
    JOIN usuario t ON t.id = a.id_titular
    JOIN usuario i ON i.id = a.id_invitado
"""


def acceso_concedidos(con: Connection, id_titular: int) -> list[dict]:
    return todos(con, _SELECT_ACCESO + "WHERE a.id_titular = :t ORDER BY i.nombre_completo", t=id_titular)


def acceso_recibidos(con: Connection, id_invitado: int) -> list[dict]:
    return todos(con, _SELECT_ACCESO + "WHERE a.id_invitado = :i AND t.activo ORDER BY t.nombre_completo", i=id_invitado)


def acceso_buscar(con: Connection, id_titular: int, id_invitado: int) -> dict | None:
    return uno(
        con, _SELECT_ACCESO + "WHERE a.id_titular = :t AND a.id_invitado = :i AND t.activo", t=id_titular, i=id_invitado
    )


def acceso_conceder(con: Connection, id_titular: int, id_invitado: int) -> None:
    ejecutar(con, "INSERT INTO acceso_compartido (id_titular, id_invitado) VALUES (:t, :i)", t=id_titular, i=id_invitado)


def acceso_revocar(con: Connection, id_titular: int, id_acceso: int) -> int:
    return ejecutar(con, "DELETE FROM acceso_compartido WHERE id = :id AND id_titular = :t", id=id_acceso, t=id_titular)


# ====================================================================== atajos

_SELECT_ATAJO = """
    SELECT a.id, a.nombre, a.tipo, a.monto, a.id_categoria, a.id_fuente, c.nombre AS nombre_categoria
    FROM atajo a JOIN categoria c ON c.id = a.id_categoria
"""


def atajo_listar(con: Connection, id_usuario: int) -> list[dict]:
    return todos(con, _SELECT_ATAJO + "WHERE a.id_usuario = :u ORDER BY a.id", u=id_usuario)


def atajo_buscar(con: Connection, id_usuario: int, id_atajo: int) -> dict | None:
    return uno(con, _SELECT_ATAJO + "WHERE a.id = :id AND a.id_usuario = :u", id=id_atajo, u=id_usuario)


def atajo_contar(con: Connection, id_usuario: int) -> int:
    return valor(con, "SELECT COUNT(*) FROM atajo WHERE id_usuario = :u", u=id_usuario)


def atajo_existe_nombre(con: Connection, id_usuario: int, nombre: str) -> bool:
    return _existe_nombre(con, "atajo", id_usuario, nombre, None)


def atajo_insertar(con: Connection, id_usuario: int, a: dict) -> int:
    return valor(
        con,
        """INSERT INTO atajo (id_usuario, nombre, tipo, monto, id_categoria, id_fuente)
           VALUES (:u, :nombre, :tipo, :monto, :id_categoria, :id_fuente) RETURNING id""",
        u=id_usuario,
        nombre=a["nombre"],
        tipo=str(a["tipo"]),
        monto=a["monto"],
        id_categoria=a["id_categoria"],
        id_fuente=a.get("id_fuente"),
    )


def atajo_eliminar(con: Connection, id_usuario: int, id_atajo: int) -> None:
    ejecutar(con, "DELETE FROM atajo WHERE id = :id AND id_usuario = :u", id=id_atajo, u=id_usuario)


# ====================================================================== recuperación de contraseña
# Las fechas se calculan con now() de PostgreSQL: una sola fuente de tiempo para crear y validar.


def recuperacion_insertar(con: Connection, id_usuario: int, pin_hash: str, minutos: int) -> None:
    ejecutar(
        con,
        """INSERT INTO recuperacion_contrasena (id_usuario, pin_hash, expira_en)
           VALUES (:u, :h, now() + (:m * INTERVAL '1 minute'))""",
        u=id_usuario,
        h=pin_hash,
        m=minutos,
    )


def recuperacion_reciente(con: Connection, id_usuario: int, segundos: int) -> bool:
    return valor(
        con,
        """SELECT EXISTS (SELECT 1 FROM recuperacion_contrasena
                          WHERE id_usuario = :u AND fecha_creacion > now() - (:s * INTERVAL '1 second'))""",
        u=id_usuario,
        s=segundos,
    )


def recuperacion_anular_pendientes(con: Connection, id_usuario: int) -> None:
    ejecutar(con, "UPDATE recuperacion_contrasena SET usada = TRUE WHERE id_usuario = :u AND NOT usada", u=id_usuario)


def recuperacion_vigente_para_actualizar(con: Connection, id_usuario: int, maximo_intentos: int) -> dict | None:
    return uno(
        con,
        """SELECT id, pin_hash, intentos FROM recuperacion_contrasena
           WHERE id_usuario = :u AND NOT usada AND expira_en > now() AND intentos < :max
           ORDER BY fecha_creacion DESC LIMIT 1
           FOR UPDATE""",
        u=id_usuario,
        max=maximo_intentos,
    )


def recuperacion_intento_fallido(con: Connection, id_solicitud: int) -> int:
    return valor(
        con, "UPDATE recuperacion_contrasena SET intentos = intentos + 1 WHERE id = :id RETURNING intentos", id=id_solicitud
    )


def recuperacion_marcar_usada(con: Connection, id_solicitud: int) -> None:
    ejecutar(con, "UPDATE recuperacion_contrasena SET usada = TRUE WHERE id = :id", id=id_solicitud)
