from sqlalchemy import Connection, text

_COLUMNAS = (
    "id, nombre_usuario, nombre_completo, correo, (correo_verificado_en IS NOT NULL) AS correo_verificado, "
    "rol, activo, fecha_registro"
)


def por_nombre_usuario(con: Connection, nombre_usuario: str) -> dict | None:
    fila = con.execute(
        text(f"SELECT {_COLUMNAS}, contrasena_hash FROM usuario WHERE nombre_usuario = :n"),
        {"n": nombre_usuario},
    ).mappings().first()
    return dict(fila) if fila else None


def por_correo(con: Connection, correo: str, solo_verificado: bool = False) -> dict | None:
    filtro = " AND correo_verificado_en IS NOT NULL" if solo_verificado else ""
    fila = con.execute(
        text(f"SELECT {_COLUMNAS}, contrasena_hash FROM usuario WHERE lower(correo) = lower(:c){filtro}"),
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


def hash_contrasena(con: Connection, id_usuario: int) -> str | None:
    return con.execute(text("SELECT contrasena_hash FROM usuario WHERE id = :id"), {"id": id_usuario}).scalar_one_or_none()


def actualizar_nombre(con: Connection, id_usuario: int, nombre_completo: str) -> None:
    con.execute(text("UPDATE usuario SET nombre_completo = :n WHERE id = :id"), {"n": nombre_completo, "id": id_usuario})


def correo_verificado_de_otra_cuenta(con: Connection, correo: str, id_usuario: int) -> bool:
    return con.execute(
        text(
            "SELECT 1 FROM usuario WHERE lower(correo) = lower(:c) AND id <> :u "
            "AND correo_verificado_en IS NOT NULL"
        ),
        {"c": correo, "u": id_usuario},
    ).first() is not None


def fijar_correo_verificado(con: Connection, id_usuario: int, correo: str) -> None:
    """Quien demuestra que controla una dirección se queda con ella: si otra
    cuenta la tenía escrita **sin verificar**, se le quita (no podía usarla para
    recuperar la contraseña). Una verificada en otra cuenta no se toca."""
    con.execute(
        text(
            "UPDATE usuario SET correo = NULL, correo_verificado_en = NULL "
            "WHERE lower(correo) = lower(:c) AND id <> :u AND correo_verificado_en IS NULL"
        ),
        {"c": correo, "u": id_usuario},
    )
    con.execute(
        text("UPDATE usuario SET correo = :c, correo_verificado_en = now() WHERE id = :u"),
        {"c": correo, "u": id_usuario},
    )


def registrar_ingreso(con: Connection, id_usuario: int) -> None:
    con.execute(text("UPDATE usuario SET ultimo_ingreso_en = now() WHERE id = :id"), {"id": id_usuario})
