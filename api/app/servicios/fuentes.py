from datetime import date

from sqlalchemy import Connection

from app.errores import NoEncontrado, ReglaNegocio
from app.esquemas.entradas import FuenteForm
from app.modelo import calculos
from app.repos import fuente as repo
from app.repos import movimiento as repo_mov


def listar(con: Connection, id_usuario: int) -> list[dict]:
    return repo.listar(con, id_usuario)


def obtener(con: Connection, id_usuario: int, id_fuente: int) -> dict:
    f = repo.buscar(con, id_usuario, id_fuente)
    if f is None:
        raise NoEncontrado("Fuente no encontrada")
    return f


def obtener_activa(con: Connection, id_usuario: int, id_fuente: int) -> dict:
    f = obtener(con, id_usuario, id_fuente)
    if not f["activa"]:
        raise ReglaNegocio("Esa fuente está desactivada. Actívala para registrarle movimientos.", "id_fuente")
    return f


def crear(con: Connection, id_usuario: int, form: FuenteForm) -> dict:
    nombre = _nombre(form.nombre)
    _validar_unico(con, id_usuario, nombre, None)
    return repo.insertar(con, id_usuario, nombre, str(form.frecuencia))


def actualizar(con: Connection, id_usuario: int, id_fuente: int, form: FuenteForm) -> dict:
    obtener(con, id_usuario, id_fuente)
    nombre = _nombre(form.nombre)
    _validar_unico(con, id_usuario, nombre, id_fuente)
    repo.actualizar(con, id_usuario, id_fuente, nombre, str(form.frecuencia))
    return obtener(con, id_usuario, id_fuente)


def cambiar_estado(con: Connection, id_usuario: int, id_fuente: int, activa: bool) -> dict:
    obtener(con, id_usuario, id_fuente)
    repo.cambiar_estado(con, id_usuario, id_fuente, activa)
    return obtener(con, id_usuario, id_fuente)


def resumen(con: Connection, id_usuario: int, desde: date, hasta: date) -> list[dict]:
    """Estado de resultados por fuente activa (RN-02): bruto − costos."""
    return [
        {**r, **calculos.resumen_fuente(r["bruto"], r["costos"], r["dias_trabajados"])}
        for r in repo_mov.resumen_por_fuente(con, id_usuario, desde, hasta)
    ]


def _nombre(nombre: str) -> str:
    nombre = nombre.strip()
    if not nombre:
        raise ReglaNegocio("Escribe el nombre de la fuente.", "nombre")
    return nombre


def _validar_unico(con: Connection, id_usuario: int, nombre: str, excluido: int | None) -> None:
    if repo.existe_nombre(con, id_usuario, nombre, excluido):
        raise ReglaNegocio("Ya tienes una fuente con ese nombre.", "nombre")
