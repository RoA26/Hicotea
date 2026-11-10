"""Botones rápidos del tablero ("fricción cero"): plantillas de ingreso o
gasto que se registran con un toque, con la fecha de hoy. Se validan con las
mismas reglas del formulario general al crearlos y otra vez al usarlos (la
categoría o la fuente pudieron desactivarse después)."""

from sqlalchemy import Connection

from app.errores import NoEncontrado, ReglaNegocio
from app.esquemas.entradas import AtajoForm, MovimientoForm
from app.modelo import dinero, reloj
from app.modelo.enums import TipoMovimiento
from app.repos import otros as repo
from app.servicios import movimientos

MAXIMO_POR_USUARIO = 12


def listar(con: Connection, id_usuario: int) -> list[dict]:
    return repo.atajo_listar(con, id_usuario)


def obtener(con: Connection, id_usuario: int, id_atajo: int) -> dict:
    a = repo.atajo_buscar(con, id_usuario, id_atajo)
    if a is None:
        raise NoEncontrado("Botón rápido no encontrado")
    return a


def crear(con: Connection, id_usuario: int, form: AtajoForm) -> dict:
    nombre = form.nombre.strip()
    if not nombre:
        raise ReglaNegocio("Escribe el nombre del botón.", "nombre")
    if repo.atajo_contar(con, id_usuario) >= MAXIMO_POR_USUARIO:
        raise ReglaNegocio(f"Puedes tener hasta {MAXIMO_POR_USUARIO} botones rápidos. Elimina uno para crear otro.")
    if repo.atajo_existe_nombre(con, id_usuario, nombre):
        raise ReglaNegocio("Ya tienes un botón con ese nombre.", "nombre")
    plantilla = movimientos.validar(
        con,
        id_usuario,
        MovimientoForm(
            tipo=TipoMovimiento(form.tipo), fecha=reloj.hoy(), monto=form.monto,
            id_categoria=form.id_categoria, id_fuente=form.id_fuente,
        ),
    )
    id_atajo = repo.atajo_insertar(con, id_usuario, {**plantilla, "nombre": nombre})
    return obtener(con, id_usuario, id_atajo)


def eliminar(con: Connection, id_usuario: int, id_atajo: int) -> None:
    obtener(con, id_usuario, id_atajo)
    repo.atajo_eliminar(con, id_usuario, id_atajo)


def usar(con: Connection, id_usuario: int, id_atajo: int) -> tuple[dict, int]:
    """Registra el movimiento del botón con la fecha de hoy; devuelve (atajo, id del movimiento)."""
    a = obtener(con, id_usuario, id_atajo)
    id_movimiento = movimientos.registrar(
        con,
        id_usuario,
        MovimientoForm(
            tipo=TipoMovimiento(a["tipo"]), fecha=reloj.hoy(), monto=dinero.a_texto(a["monto"]),
            id_categoria=a["id_categoria"], id_fuente=a["id_fuente"], descripcion=a["nombre"],
        ),
    )
    return a, id_movimiento
