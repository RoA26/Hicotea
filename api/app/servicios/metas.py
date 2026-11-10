"""Metas de ahorro: el progreso sale del saldo de la cajita vinculada."""

from sqlalchemy import Connection

from app.errores import NoEncontrado, ReglaNegocio
from app.esquemas.entradas import MetaForm
from app.modelo import calculos, dinero, reloj
from app.repos import otros as repo
from app.servicios import cajitas


def _con_progreso(m: dict, hoy) -> dict:
    return {**m, **calculos.progreso_meta(m["saldo_cajita"], m["monto_objetivo"], m["fecha_objetivo"], hoy)}


def listar(con: Connection, id_usuario: int) -> list[dict]:
    hoy = reloj.hoy()
    return [_con_progreso(m, hoy) for m in repo.meta_listar(con, id_usuario)]


def listar_activas(con: Connection, id_usuario: int) -> list[dict]:
    return [m for m in listar(con, id_usuario) if m["activa"]]


def obtener(con: Connection, id_usuario: int, id_meta: int) -> dict:
    m = repo.meta_buscar(con, id_usuario, id_meta)
    if m is None:
        raise NoEncontrado("Meta no encontrada")
    return _con_progreso(m, reloj.hoy())


def crear(con: Connection, id_usuario: int, form: MetaForm) -> dict:
    id_meta = repo.meta_insertar(con, id_usuario, _construir(con, id_usuario, form, None))
    return obtener(con, id_usuario, id_meta)


def actualizar(con: Connection, id_usuario: int, id_meta: int, form: MetaForm) -> dict:
    obtener(con, id_usuario, id_meta)
    repo.meta_actualizar(con, id_usuario, id_meta, _construir(con, id_usuario, form, id_meta))
    return obtener(con, id_usuario, id_meta)


def cambiar_estado(con: Connection, id_usuario: int, id_meta: int, activa: bool) -> dict:
    obtener(con, id_usuario, id_meta)
    repo.meta_cambiar_estado(con, id_usuario, id_meta, activa)
    return obtener(con, id_usuario, id_meta)


def eliminar(con: Connection, id_usuario: int, id_meta: int) -> None:
    """Eliminar una meta no toca el dinero: sigue en su cajita."""
    obtener(con, id_usuario, id_meta)
    repo.meta_eliminar(con, id_usuario, id_meta)


def _construir(con: Connection, id_usuario: int, f: MetaForm, excluido: int | None) -> dict:
    nombre = f.nombre.strip()
    if not nombre:
        raise ReglaNegocio("Escribe el nombre de la meta.", "nombre")
    if repo.meta_existe_nombre(con, id_usuario, nombre, excluido):
        raise ReglaNegocio("Ya tienes una meta con ese nombre.", "nombre")
    # Al editar se permite una fecha ya pasada (la meta pudo vencerse).
    if f.fecha_objetivo is not None and f.fecha_objetivo <= reloj.hoy() and excluido is None:
        raise ReglaNegocio("La fecha objetivo debe ser futura.", "fecha_objetivo")
    try:
        cajita = cajitas.obtener(con, id_usuario, f.id_cajita)
    except NoEncontrado:
        raise ReglaNegocio("Esa cajita no existe.", "id_cajita")
    if not cajita["activa"]:
        raise ReglaNegocio("Esa cajita está desactivada.", "id_cajita")
    return {
        "nombre": nombre,
        "monto_objetivo": dinero.parsear(f.monto_objetivo, "monto_objetivo"),
        "fecha_objetivo": f.fecha_objetivo,
        "id_cajita": cajita["id"],
    }
