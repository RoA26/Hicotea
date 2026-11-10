"""Topes mensuales por categoría de gasto o costo, comparados con lo gastado."""

from decimal import Decimal

from sqlalchemy import Connection

from app.errores import NoEncontrado, ReglaNegocio
from app.esquemas.entradas import PresupuestoForm
from app.modelo import calculos, dinero, reloj
from app.modelo.enums import TipoCategoria
from app.repos import otros as repo
from app.servicios import categorias


def estado(con: Connection, id_usuario: int, anio: int, mes: int) -> list[dict]:
    filas = repo.presupuesto_listar_con_gastado(con, id_usuario, reloj.primer_dia(anio, mes), reloj.ultimo_dia(anio, mes))
    return [{**f, **calculos.estado_presupuesto(f["presupuestado"], f["gastado"])} for f in filas]


def del_mes(con: Connection, id_usuario: int, anio: int, mes: int) -> dict:
    estados = estado(con, id_usuario, anio, mes)
    return {
        "mes": reloj.texto_mes(anio, mes),
        "presupuestos": estados,
        "total_presupuestado": sum((e["presupuestado"] for e in estados), Decimal(0)),
        "total_gastado": sum((e["gastado"] for e in estados), Decimal(0)),
    }


def alertas_del_mes(con: Connection, id_usuario: int) -> list[dict]:
    """Presupuestos del mes actual que ya pasaron el 80% o se excedieron."""
    h = reloj.hoy()
    return [e for e in estado(con, id_usuario, h.year, h.month) if e["excedido"] or e["en_alerta"]]


def guardar(con: Connection, id_usuario: int, form: PresupuestoForm) -> None:
    """Crea o reemplaza el presupuesto de la categoría."""
    try:
        categoria = categorias.obtener(con, id_usuario, form.id_categoria)
    except NoEncontrado:
        raise ReglaNegocio("Esa categoría no existe.", "id_categoria")
    if categoria["tipo"] == TipoCategoria.INGRESO:
        raise ReglaNegocio("Los presupuestos son para categorías de gasto o costo.", "id_categoria")
    repo.presupuesto_guardar(con, id_usuario, categoria["id"], dinero.parsear(form.monto, "monto"))


def eliminar(con: Connection, id_usuario: int, id_presupuesto: int) -> None:
    if repo.presupuesto_eliminar(con, id_usuario, id_presupuesto) == 0:
        raise NoEncontrado("Presupuesto no encontrado")
