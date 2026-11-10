"""Movimientos, registro rápido del producido, atajos y tablero."""

from datetime import date

from fastapi import APIRouter, status

from app.esquemas.entradas import AtajoForm, MovimientoForm, ProducidoForm
from app.esquemas.salidas import (
    AtajoOut,
    MesCalendario,
    MovimientoOut,
    PaginaMovimientos,
    RespuestaConSaldo,
    Saldo,
    Tablero,
)
from app.modelo import dinero, reloj
from app.modelo.enums import TipoMovimiento
from app.seguridad.dependencias import Con, IdUsuario
from app.servicios import atajos, movimientos, tablero

router = APIRouter(prefix="/api", tags=["movimientos"])


def con_saldo(con, u: int, mensaje: str, id_movimiento: int | None = None, tipo=None) -> dict:
    """Respuesta de registros rápidos: mensaje + saldo actualizado para animar el contador."""
    return {"mensaje": mensaje, "id_movimiento": id_movimiento, "tipo": tipo, "saldo": tablero.saldo(con, u)}


# ------------------------------------------------------------------ movimientos


@router.get("/movimientos", response_model=PaginaMovimientos)
def listar(
    u: IdUsuario,
    con: Con,
    desde: date | None = None,
    hasta: date | None = None,
    tipo: TipoMovimiento | None = None,
    id_categoria: int | None = None,
    id_fuente: int | None = None,
    pagina: int = 0,
):
    return movimientos.buscar(
        con, u, desde=desde, hasta=hasta, tipo=tipo, id_categoria=id_categoria, id_fuente=id_fuente, pagina=pagina
    )


@router.get("/movimientos/{id_movimiento}", response_model=MovimientoOut)
def obtener(id_movimiento: int, u: IdUsuario, con: Con):
    return movimientos.obtener(con, u, id_movimiento)


@router.post("/movimientos", response_model=RespuestaConSaldo, status_code=status.HTTP_201_CREATED)
def registrar(form: MovimientoForm, u: IdUsuario, con: Con):
    id_movimiento = movimientos.registrar(con, u, form)
    mensaje = "Ingreso registrado." if form.tipo == TipoMovimiento.INGRESO else "Gasto registrado."
    return con_saldo(con, u, mensaje, id_movimiento, form.tipo)


@router.post("/movimientos/producido", response_model=RespuestaConSaldo, status_code=status.HTTP_201_CREATED)
def registrar_producido(form: ProducidoForm, u: IdUsuario, con: Con):
    id_movimiento = movimientos.registrar_producido(con, u, form)
    return con_saldo(con, u, "Producido registrado.", id_movimiento, TipoMovimiento.INGRESO)


@router.put("/movimientos/{id_movimiento}", response_model=MovimientoOut)
def actualizar(id_movimiento: int, form: MovimientoForm, u: IdUsuario, con: Con):
    return movimientos.actualizar(con, u, id_movimiento, form)


@router.delete("/movimientos/{id_movimiento}", response_model=RespuestaConSaldo)
def eliminar(id_movimiento: int, u: IdUsuario, con: Con):
    """También es el "Deshacer" tras un registro rápido."""
    movimientos.eliminar(con, u, id_movimiento)
    return con_saldo(con, u, "Movimiento eliminado.")


# ------------------------------------------------------------------ atajos


@router.get("/atajos", response_model=list[AtajoOut])
def listar_atajos(u: IdUsuario, con: Con):
    return atajos.listar(con, u)


@router.post("/atajos", response_model=AtajoOut, status_code=status.HTTP_201_CREATED)
def crear_atajo(form: AtajoForm, u: IdUsuario, con: Con):
    return atajos.crear(con, u, form)


@router.delete("/atajos/{id_atajo}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_atajo(id_atajo: int, u: IdUsuario, con: Con):
    atajos.eliminar(con, u, id_atajo)


@router.post("/atajos/{id_atajo}/usar", response_model=RespuestaConSaldo)
def usar_atajo(id_atajo: int, u: IdUsuario, con: Con):
    atajo, id_movimiento = atajos.usar(con, u, id_atajo)
    signo = "+ " if atajo["tipo"] == TipoMovimiento.INGRESO else "− "
    return con_saldo(con, u, f"{atajo['nombre']} · {signo}{dinero.formatear(atajo['monto'])}", id_movimiento, atajo["tipo"])


# ------------------------------------------------------------------ tablero y calendario


@router.get("/tablero", response_model=Tablero)
def ver_tablero(u: IdUsuario, con: Con):
    return tablero.construir(con, u)


@router.get("/saldo", response_model=Saldo)
def ver_saldo(u: IdUsuario, con: Con):
    return tablero.saldo(con, u)


@router.get("/calendario", response_model=MesCalendario)
def ver_calendario(u: IdUsuario, con: Con, mes: str | None = None):
    """`mes` como "2026-11"; vacío o inválido = mes actual."""
    return tablero.calendario(con, u, *reloj.parsear_mes(mes))
