from sqlalchemy import Connection, text

_COLUMNAS = "id, nombre_usuario, nombre_completo, correo, rol, activo, fecha_registro"


def por_nombre_usuario(con: Connection, nombre_usuario: str) -> dict | None:
    fila = con.execute(
        text(f"SELECT {_COLUMNAS}, contrasena_hash FROM usuario WHERE nombre_usuario = :n"),
        {"n": nombre_usuario},
    ).mappings().first()
    return dict(fila) if fila else None


def por_correo(con: Connection, correo: str) -> dict | None:
    fila = con.execute(
        text(f"SELECT {_COLUMNAS}, contrasena_hash FROM usuario WHERE lower(correo) = lower(:c)"),
        {"c": correo},
    ).mappings().first()
    return dict(fila) if fila else None


def por_id(con: Connection, id_usuario: int) -> dict | None:
    fila = con.execute(text(f"SELECT {_COLUMNAS} FROM usuario WHERE id = :id"), {"id": id_usuario}).mappings().first()
    return dict(fila) if fila else None


def existe(con: Connection, nombre_usuario: str) -> bool:
    return con.execute(
        text("SELECT 1 FROM usuario WHERE nombre_usuario = :n"), {"n": nombre_usuario}
    ).first() is not None


def correo_en_uso(con: Connection, correo: str) -> bool:
    return con.execute(
        text("SELECT 1 FROM usuario WHERE lower(correo) = lower(:c)"), {"c": correo}
    ).first() is not None


def crear(con: Connection, nombre_usuario: str, nombre_completo: str, contrasena_hash: str, correo: str | None = None) -> dict:
    fila = con.execute(
        text(
            "INSERT INTO usuario (nombre_usuario, nombre_completo, contrasena_hash, correo) "
            f"VALUES (:n, :c, :h, :correo) RETURNING {_COLUMNAS}"
        ),
        {"n": nombre_usuario, "c": nombre_completo, "h": contrasena_hash, "correo": correo},
    ).mappings().one()
    return dict(fila)


def actualizar_hash(con: Connection, id_usuario: int, contrasena_hash: str) -> None:
    con.execute(
        text("UPDATE usuario SET contrasena_hash = :h WHERE id = :id"),
        {"h": contrasena_hash, "id": id_usuario},
    )


def registrar_ingreso(con: Connection, id_usuario: int) -> None:
    con.execute(text("UPDATE usuario SET ultimo_ingreso_en = now() WHERE id = :id"), {"id": id_usuario})
