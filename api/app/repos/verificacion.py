"""Enlaces de verificación de correo (`verificacion_correo`). Solo se guarda el
SHA-256 del token; el enlace en claro viaja una vez, en el correo."""

from datetime import timedelta

from sqlalchemy import Connection, text


def anular_pendientes(con: Connection, id_usuario: int) -> None:
    con.execute(
        text(
            "UPDATE verificacion_correo SET anulada_en = now() "
            "WHERE id_usuario = :u AND usada_en IS NULL AND anulada_en IS NULL"
        ),
        {"u": id_usuario},
    )


def reciente(con: Connection, id_usuario: int, segundos: int) -> bool:
    return con.execute(
        text(
            "SELECT 1 FROM verificacion_correo WHERE id_usuario = :u "
            "AND creada_en > now() - make_interval(secs => :s)"
        ),
        {"u": id_usuario, "s": segundos},
    ).first() is not None


def crear(con: Connection, id_usuario: int, correo: str, token_hash: str, vigencia: timedelta) -> None:
    con.execute(
        text(
            "INSERT INTO verificacion_correo (id_usuario, correo, token_hash, expira_en) "
            "VALUES (:u, :c, :t, now() + :v)"
        ),
        {"u": id_usuario, "c": correo, "t": token_hash, "v": vigencia},
    )


def consumir(con: Connection, token_hash: str) -> dict | None:
    """Marca el enlace como usado si sigue vigente (un solo uso, también con
    peticiones simultáneas: la segunda espera el bloqueo de fila y ya no lo ve vigente)."""
    fila = con.execute(
        text(
            "UPDATE verificacion_correo SET usada_en = now() "
            "WHERE token_hash = :t AND usada_en IS NULL AND anulada_en IS NULL AND expira_en > now() "
            "RETURNING id_usuario, correo"
        ),
        {"t": token_hash},
    ).mappings().first()
    return dict(fila) if fila else None


def pendiente(con: Connection, id_usuario: int) -> dict | None:
    fila = con.execute(
        text(
            "SELECT correo, creada_en, expira_en FROM verificacion_correo "
            "WHERE id_usuario = :u AND usada_en IS NULL AND anulada_en IS NULL AND expira_en > now() "
            "ORDER BY creada_en DESC LIMIT 1"
        ),
        {"u": id_usuario},
    ).mappings().first()
    return dict(fila) if fila else None
