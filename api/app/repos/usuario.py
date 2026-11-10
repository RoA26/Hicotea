from sqlalchemy import Connection, text

_COLUMNAS = "id, nombre_usuario, nombre_completo, activo, fecha_registro"


def por_nombre_usuario(con: Connection, nombre_usuario: str) -> dict | None:
    fila = con.execute(
        text(f"SELECT {_COLUMNAS}, contrasena_hash FROM usuario WHERE nombre_usuario = :n"),
        {"n": nombre_usuario},
    ).mappings().first()
    return dict(fila) if fila else None


def existe(con: Connection, nombre_usuario: str) -> bool:
    return con.execute(
        text("SELECT 1 FROM usuario WHERE nombre_usuario = :n"), {"n": nombre_usuario}
    ).first() is not None


def crear(con: Connection, nombre_usuario: str, nombre_completo: str, contrasena_hash: str) -> dict:
    fila = con.execute(
        text(
            "INSERT INTO usuario (nombre_usuario, nombre_completo, contrasena_hash) "
            f"VALUES (:n, :c, :h) RETURNING {_COLUMNAS}"
        ),
        {"n": nombre_usuario, "c": nombre_completo, "h": contrasena_hash},
    ).mappings().one()
    return dict(fila)


def actualizar_hash(con: Connection, id_usuario: int, contrasena_hash: str) -> None:
    con.execute(
        text("UPDATE usuario SET contrasena_hash = :h WHERE id = :id"),
        {"h": contrasena_hash, "id": id_usuario},
    )
