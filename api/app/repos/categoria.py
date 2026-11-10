from sqlalchemy import Connection, text

from app.repos._sql import EXCLUIDO, ejecutar, todos, uno, valor

_COLUMNAS = "id, nombre, tipo, activa"


def insertar_varias(con: Connection, id_usuario: int, categorias: list[tuple[str, str]]) -> None:
    con.execute(
        text("INSERT INTO categoria (id_usuario, nombre, tipo) VALUES (:u, :nombre, :tipo)"),
        [{"u": id_usuario, "nombre": n, "tipo": t} for n, t in categorias],
    )


def listar(con: Connection, id_usuario: int) -> list[dict]:
    return todos(
        con,
        f"SELECT {_COLUMNAS} FROM categoria WHERE id_usuario = :u ORDER BY tipo, activa DESC, nombre",
        u=id_usuario,
    )


def buscar(con: Connection, id_usuario: int, id_categoria: int) -> dict | None:
    return uno(
        con, f"SELECT {_COLUMNAS} FROM categoria WHERE id = :id AND id_usuario = :u", id=id_categoria, u=id_usuario
    )


def insertar(con: Connection, id_usuario: int, nombre: str, tipo: str) -> dict:
    return uno(
        con,
        f"INSERT INTO categoria (id_usuario, nombre, tipo) VALUES (:u, :n, :t) RETURNING {_COLUMNAS}",
        u=id_usuario,
        n=nombre,
        t=tipo,
    )


def existe_nombre(con: Connection, id_usuario: int, tipo: str, nombre: str, excluido: int | None) -> bool:
    return valor(
        con,
        f"""SELECT EXISTS (SELECT 1 FROM categoria
                          WHERE id_usuario = :u AND tipo = :t AND lower(nombre) = lower(:n)
                            AND id <> {EXCLUIDO})""",
        u=id_usuario,
        t=tipo,
        n=nombre,
        excluido=excluido,
    )


def actualizar_nombre(con: Connection, id_usuario: int, id_categoria: int, nombre: str) -> None:
    ejecutar(con, "UPDATE categoria SET nombre = :n WHERE id = :id AND id_usuario = :u", n=nombre, id=id_categoria, u=id_usuario)


def cambiar_estado(con: Connection, id_usuario: int, id_categoria: int, activa: bool) -> None:
    ejecutar(con, "UPDATE categoria SET activa = :a WHERE id = :id AND id_usuario = :u", a=activa, id=id_categoria, u=id_usuario)
