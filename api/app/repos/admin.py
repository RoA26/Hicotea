"""SQL de administración de plataforma: invitaciones, cuentas y auditoría.

Ninguna consulta de este módulo toca tablas financieras (movimiento, cajita,
meta, presupuesto, recurrente, fuente, categoría, atajo)."""

from datetime import timedelta

from sqlalchemy import Connection

from app.repos._sql import ejecutar, todos, uno, valor

# Estado derivado de las fechas; el orden importa (revocada y usada mandan sobre vencida).
_ESTADO_INVITACION = """CASE
    WHEN i.revocada_en IS NOT NULL THEN 'REVOCADA'
    WHEN i.usada_en IS NOT NULL THEN 'USADA'
    WHEN i.expira_en <= now() THEN 'EXPIRADA'
    ELSE 'PENDIENTE' END"""

_SELECT_INVITACION = f"""
SELECT i.id, i.correo, i.nota, i.creada_en, i.expira_en, i.usada_en, i.revocada_en,
       {_ESTADO_INVITACION} AS estado,
       c.nombre_usuario AS creada_por, u.nombre_usuario AS usada_por, r.nombre_usuario AS revocada_por
FROM invitacion i
LEFT JOIN usuario c ON c.id = i.creada_por
LEFT JOIN usuario u ON u.id = i.usada_por
LEFT JOIN usuario r ON r.id = i.revocada_por
"""

# ====================================================================== bloqueo global


def bloquear_administracion(con: Connection) -> None:
    """Serializa las acciones que cambian cuentas o roles: dos administradores
    bloqueándose a la vez no pueden dejar la plataforma sin administrador."""
    con.exec_driver_sql("SELECT pg_advisory_xact_lock(hashtext('hicotea.administracion'))")


# ====================================================================== invitaciones


def invitacion_crear(
    con: Connection, token_hash: str, vigencia: timedelta, creada_por: int | None, correo: str | None, nota: str | None
) -> dict:
    id_inv = valor(
        con,
        """INSERT INTO invitacion (token_hash, correo, nota, creada_por, expira_en)
           VALUES (:t, :c, :n, :p, now() + :v) RETURNING id""",
        t=token_hash, c=correo, n=nota, p=creada_por, v=vigencia,
    )
    return invitacion_por_id(con, id_inv)


def invitacion_por_id(con: Connection, id_inv: int) -> dict | None:
    return uno(con, _SELECT_INVITACION + "WHERE i.id = :id", id=id_inv)


def invitacion_vigente_por_hash(con: Connection, token_hash: str) -> dict | None:
    return uno(
        con,
        """SELECT id, correo FROM invitacion
           WHERE token_hash = :t AND usada_en IS NULL AND revocada_en IS NULL AND expira_en > now()""",
        t=token_hash,
    )


def invitacion_consumir(con: Connection, token_hash: str) -> dict | None:
    """Marca la invitación como usada si sigue vigente. Es una sola sentencia
    UPDATE ... WHERE vigente: si dos registros llegan a la vez, PostgreSQL
    bloquea la fila y el segundo vuelve a evaluar el WHERE ya con `usada_en`
    puesto, así que no actualiza nada. Si el registro falla después, la
    transacción se revierte y la invitación vuelve a quedar pendiente."""
    return uno(
        con,
        """UPDATE invitacion SET usada_en = now()
           WHERE token_hash = :t AND usada_en IS NULL AND revocada_en IS NULL AND expira_en > now()
           RETURNING id, correo""",
        t=token_hash,
    )


def invitacion_asignar_usuario(con: Connection, id_inv: int, id_usuario: int) -> None:
    ejecutar(con, "UPDATE invitacion SET usada_por = :u WHERE id = :id", u=id_usuario, id=id_inv)


def invitacion_revocar(con: Connection, id_inv: int, id_admin: int) -> int:
    """Solo revoca invitaciones pendientes (ni usadas, ni revocadas, ni vencidas)."""
    return ejecutar(
        con,
        """UPDATE invitacion SET revocada_en = now(), revocada_por = :a
           WHERE id = :id AND usada_en IS NULL AND revocada_en IS NULL AND expira_en > now()""",
        id=id_inv, a=id_admin,
    )


def invitaciones_listar(con: Connection, estado: str | None, limite: int, desplazamiento: int) -> tuple[list[dict], int]:
    filtro = f"WHERE {_ESTADO_INVITACION} = :estado " if estado else ""
    filas = todos(
        con, _SELECT_INVITACION + filtro + "ORDER BY i.creada_en DESC, i.id DESC LIMIT :l OFFSET :o",
        estado=estado, l=limite, o=desplazamiento,
    )
    total = valor(con, f"SELECT COUNT(*) FROM invitacion i {filtro}", estado=estado)
    return filas, total


def invitaciones_por_estado(con: Connection) -> dict[str, int]:
    filas = todos(con, f"SELECT {_ESTADO_INVITACION} AS estado, COUNT(*) AS n FROM invitacion i GROUP BY 1")
    conteo = {"PENDIENTE": 0, "USADA": 0, "EXPIRADA": 0, "REVOCADA": 0}
    conteo.update({f["estado"]: f["n"] for f in filas})
    return conteo


# ====================================================================== cuentas

_SELECT_CUENTA = """
SELECT u.id, u.nombre_usuario, u.nombre_completo, u.correo, u.rol, u.activo, u.bloqueado_en,
       u.fecha_registro, u.ultimo_ingreso_en,
       (SELECT COUNT(*) FROM sesion s WHERE s.id_usuario = u.id AND s.expira_en > now()) AS sesiones_activas
FROM usuario u
"""


def cuentas_listar(
    con: Connection, busqueda: str | None, estado: str | None, rol: str | None, limite: int, desplazamiento: int
) -> tuple[list[dict], int]:
    condiciones = []
    if busqueda:
        condiciones.append(
            "(u.nombre_usuario ILIKE :q OR u.nombre_completo ILIKE :q OR COALESCE(u.correo, '') ILIKE :q)"
        )
    if estado == "ACTIVA":
        condiciones.append("u.activo")
    elif estado == "BLOQUEADA":
        condiciones.append("NOT u.activo")
    if rol:
        condiciones.append("u.rol = :rol")
    donde = ("WHERE " + " AND ".join(condiciones) + " ") if condiciones else ""
    # Los comodines de ILIKE que escriba el administrador se tratan como texto.
    q = None
    if busqueda:
        q = "%" + busqueda.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
    filas = todos(
        con, _SELECT_CUENTA + donde + "ORDER BY u.fecha_registro DESC, u.id DESC LIMIT :l OFFSET :o",
        q=q, rol=rol, l=limite, o=desplazamiento,
    )
    total = valor(con, f"SELECT COUNT(*) FROM usuario u {donde}", q=q, rol=rol)
    return filas, total


def cuenta_por_id(con: Connection, id_usuario: int) -> dict | None:
    return uno(con, _SELECT_CUENTA + "WHERE u.id = :id", id=id_usuario)


def cuenta_por_nombre(con: Connection, nombre_usuario: str) -> dict | None:
    return uno(con, _SELECT_CUENTA + "WHERE u.nombre_usuario = :n", n=nombre_usuario)


def cuentas_conteo(con: Connection) -> dict[str, int]:
    return uno(
        con,
        """SELECT COUNT(*) AS total,
                  COUNT(*) FILTER (WHERE activo) AS activas,
                  COUNT(*) FILTER (WHERE NOT activo) AS bloqueadas,
                  COUNT(*) FILTER (WHERE rol = 'ADMIN' AND activo) AS administradores
           FROM usuario""",
    )


def admins_activos(con: Connection, excluir: int | None = None) -> int:
    return valor(
        con,
        "SELECT COUNT(*) FROM usuario WHERE rol = 'ADMIN' AND activo AND id <> COALESCE(CAST(:e AS BIGINT), -1)",
        e=excluir,
    )


def cuenta_bloquear(con: Connection, id_usuario: int) -> None:
    ejecutar(con, "UPDATE usuario SET activo = FALSE, bloqueado_en = now() WHERE id = :id", id=id_usuario)


def cuenta_desbloquear(con: Connection, id_usuario: int) -> None:
    ejecutar(con, "UPDATE usuario SET activo = TRUE, bloqueado_en = NULL WHERE id = :id", id=id_usuario)


def cuenta_cambiar_rol(con: Connection, id_usuario: int, rol: str) -> None:
    ejecutar(con, "UPDATE usuario SET rol = :r WHERE id = :id", r=rol, id=id_usuario)


# ====================================================================== auditoría


def auditar(
    con: Connection,
    *,
    id_admin: int | None,
    admin_nombre: str,
    accion: str,
    recurso_tipo: str,
    recurso_id: int | None = None,
    recurso_nombre: str | None = None,
    resultado: str = "EXITO",
    detalle: str | None = None,
) -> None:
    ejecutar(
        con,
        """INSERT INTO auditoria_admin
             (id_admin, admin_nombre, accion, recurso_tipo, recurso_id, recurso_nombre, resultado, detalle)
           VALUES (:a, :an, :ac, :rt, :ri, :rn, :res, :d)""",
        a=id_admin, an=admin_nombre[:30], ac=accion, rt=recurso_tipo, ri=recurso_id,
        rn=(recurso_nombre or None) and recurso_nombre[:60], res=resultado, d=(detalle or None) and detalle[:200],
    )


def auditoria_listar(con: Connection, limite: int, desplazamiento: int) -> tuple[list[dict], int]:
    filas = todos(
        con,
        """SELECT id, fecha, admin_nombre, accion, recurso_tipo, recurso_id, recurso_nombre, resultado, detalle
           FROM auditoria_admin ORDER BY fecha DESC, id DESC LIMIT :l OFFSET :o""",
        l=limite, o=desplazamiento,
    )
    return filas, valor(con, "SELECT COUNT(*) FROM auditoria_admin")
