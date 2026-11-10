from sqlalchemy import Connection

from app.repos._sql import EXCLUIDO, ejecutar, todos, uno, valor

# La fecha de creación se expresa como fecha de Colombia (la usa el calendario).
_COLUMNAS = "id, nombre, frecuencia, activa, (fecha_creacion AT TIME ZONE 'America/Bogota')::date AS fecha_creacion"


def listar(con: Connection, id_usuario: int) -> list[dict]:
    return todos(
        con, f"SELECT {_COLUMNAS} FROM fuente_ingreso WHERE id_usuario = :u ORDER BY activa DESC, nombre", u=id_usuario
    )


def buscar(con: Connection, id_usuario: int, id_fuente: int) -> dict | None:
    return uno(
        con, f"SELECT {_COLUMNAS} FROM fuente_ingreso WHERE id = :id AND id_usuario = :u", id=id_fuente, u=id_usuario
    )


def insertar(con: Connection, id_usuario: int, nombre: str, frecuencia: str) -> dict:
    return uno(
        con,
        f"INSERT INTO fuente_ingreso (id_usuario, nombre, frecuencia) VALUES (:u, :n, :f) RETURNING {_COLUMNAS}",
        u=id_usuario,
        n=nombre,
        f=frecuencia,
    )


def actualizar(con: Connection, id_usuario: int, id_fuente: int, nombre: str, frecuencia: str) -> None:
    ejecutar(
        con,
        "UPDATE fuente_ingreso SET nombre = :n, frecuencia = :f WHERE id = :id AND id_usuario = :u",
        n=nombre,
        f=frecuencia,
        id=id_fuente,
        u=id_usuario,
    )


def cambiar_estado(con: Connection, id_usuario: int, id_fuente: int, activa: bool) -> None:
    ejecutar(con, "UPDATE fuente_ingreso SET activa = :a WHERE id = :id AND id_usuario = :u", a=activa, id=id_fuente, u=id_usuario)


def existe_nombre(con: Connection, id_usuario: int, nombre: str, excluido: int | None) -> bool:
    return valor(
        con,
        f"""SELECT EXISTS (SELECT 1 FROM fuente_ingreso
                          WHERE id_usuario = :u AND lower(nombre) = lower(:n) AND id <> {EXCLUIDO})""",
        u=id_usuario,
        n=nombre,
        excluido=excluido,
    )
