from datetime import timedelta

from sqlalchemy import Connection, text


def crear(con: Connection, token_hash: str, id_usuario: int, duracion: timedelta) -> None:
    con.execute(
        text(
            "INSERT INTO sesion (token_hash, id_usuario, expira_en) "
            "VALUES (:t, :u, now() + :d)"
        ),
        {"t": token_hash, "u": id_usuario, "d": duracion},
    )


def usuario_por_token(con: Connection, token_hash: str) -> dict | None:
    fila = con.execute(
        text(
            "SELECT u.id, u.nombre_usuario, u.nombre_completo, u.correo, "
            "(u.correo_verificado_en IS NOT NULL) AS correo_verificado, u.rol, u.activo, u.fecha_registro "
            "FROM sesion s JOIN usuario u ON u.id = s.id_usuario "
            "WHERE s.token_hash = :t AND s.expira_en > now() AND u.activo"
        ),
        {"t": token_hash},
    ).mappings().first()
    return dict(fila) if fila else None


def borrar(con: Connection, token_hash: str) -> None:
    con.execute(text("DELETE FROM sesion WHERE token_hash = :t"), {"t": token_hash})


def borrar_vencidas(con: Connection, id_usuario: int) -> None:
    con.execute(
        text("DELETE FROM sesion WHERE id_usuario = :u AND expira_en <= now()"), {"u": id_usuario}
    )


def borrar_todas(con: Connection, id_usuario: int) -> int:
    return con.execute(text("DELETE FROM sesion WHERE id_usuario = :u"), {"u": id_usuario}).rowcount


def borrar_otras(con: Connection, id_usuario: int, token_hash_actual: str) -> int:
    """Cierra todas las sesiones del usuario menos la de esta petición."""
    return con.execute(
        text("DELETE FROM sesion WHERE id_usuario = :u AND token_hash <> :t"), {"u": id_usuario, "t": token_hash_actual}
    ).rowcount


def contar_activas(con: Connection, id_usuario: int) -> int:
    return con.execute(
        text("SELECT COUNT(*) FROM sesion WHERE id_usuario = :u AND expira_en > now()"), {"u": id_usuario}
    ).scalar_one()
