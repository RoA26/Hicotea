"""Compartir la cuenta (solo lectura) y ver las cuentas compartidas conmigo.

Las rutas /api/compartido/{id_titular}/... solo exponen GET y cada petición
verifica primero el permiso. Aunque alguien forzara una escritura, todas las
escrituras se filtran por el id del usuario autenticado (RN-07)."""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.esquemas.entradas import CompartirForm
from app.esquemas.salidas import AccesoOut, MesCalendario, PaginaMovimientos, Tablero
from app.modelo import reloj
from app.modelo.enums import TipoMovimiento
from app.seguridad.dependencias import Con, IdUsuario
from app.servicios import compartir, movimientos, tablero

router = APIRouter(prefix="/api", tags=["compartir"])


@router.get("/compartir", response_model=list[AccesoOut])
def concedidos(u: IdUsuario, con: Con):
    """Personas que pueden ver mi cuenta."""
    return compartir.concedidos(con, u)


@router.get("/compartir/recibidos", response_model=list[AccesoOut])
def recibidos(u: IdUsuario, con: Con):
    """Cuentas que puedo ver."""
    return compartir.recibidos(con, u)


@router.post("/compartir", response_model=list[AccesoOut], status_code=status.HTTP_201_CREATED)
def conceder(form: CompartirForm, u: IdUsuario, con: Con):
    compartir.conceder(con, u, form.nombre_usuario)
    return compartir.concedidos(con, u)


@router.delete("/compartir/{id_acceso}", status_code=status.HTTP_204_NO_CONTENT)
def revocar(id_acceso: int, u: IdUsuario, con: Con):
    compartir.revocar(con, u, id_acceso)


# ------------------------------------------------------------------ cuenta de otra persona


def titular_verificado(id_titular: int, u: IdUsuario, con: Con) -> int:
    compartir.verificar(con, u, id_titular)
    return id_titular


Titular = Annotated[int, Depends(titular_verificado)]


@router.get("/compartido/{id_titular}/tablero", response_model=Tablero)
def tablero_compartido(titular: Titular, con: Con):
    return tablero.construir(con, titular)


@router.get("/compartido/{id_titular}/movimientos", response_model=PaginaMovimientos)
def movimientos_compartidos(
    titular: Titular,
    con: Con,
    desde: date | None = None,
    hasta: date | None = None,
    tipo: TipoMovimiento | None = None,
    id_categoria: int | None = None,
    id_fuente: int | None = None,
    pagina: int = 0,
):
    return movimientos.buscar(
        con, titular, desde=desde, hasta=hasta, tipo=tipo, id_categoria=id_categoria, id_fuente=id_fuente, pagina=pagina
    )


@router.get("/compartido/{id_titular}/calendario", response_model=MesCalendario)
def calendario_compartido(titular: Titular, con: Con, mes: str | None = None):
    return tablero.calendario(con, titular, *reloj.parsear_mes(mes))
