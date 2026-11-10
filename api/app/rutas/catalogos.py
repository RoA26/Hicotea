"""Categorías y fuentes de ingreso."""

from datetime import date

from fastapi import APIRouter, status

from app.errores import ReglaNegocio
from app.esquemas.entradas import CategoriaCambio, CategoriaForm, EstadoForm, FuenteForm
from app.esquemas.salidas import CategoriaOut, FuenteOut, ResumenFuente
from app.modelo import reloj
from app.seguridad.dependencias import Con, IdUsuario
from app.servicios import categorias, fuentes

router = APIRouter(prefix="/api", tags=["catálogos"])


# ------------------------------------------------------------------ categorías


@router.get("/categorias", response_model=list[CategoriaOut])
def listar_categorias(u: IdUsuario, con: Con):
    return categorias.listar(con, u)


@router.post("/categorias", response_model=CategoriaOut, status_code=status.HTTP_201_CREATED)
def crear_categoria(form: CategoriaForm, u: IdUsuario, con: Con):
    return categorias.crear(con, u, form)


@router.patch("/categorias/{id_categoria}", response_model=CategoriaOut)
def cambiar_categoria(id_categoria: int, cambio: CategoriaCambio, u: IdUsuario, con: Con):
    return categorias.cambiar(con, u, id_categoria, cambio)


# ------------------------------------------------------------------ fuentes


@router.get("/fuentes", response_model=list[FuenteOut])
def listar_fuentes(u: IdUsuario, con: Con):
    return fuentes.listar(con, u)


@router.get("/fuentes/resumen", response_model=list[ResumenFuente])
def resumen_fuentes(u: IdUsuario, con: Con, desde: date | None = None, hasta: date | None = None):
    """Estado de resultados por fuente. Sin fechas: el mes actual."""
    if desde is None or hasta is None:
        h = reloj.hoy()
        desde, hasta = reloj.primer_dia(h.year, h.month), reloj.ultimo_dia(h.year, h.month)
    if desde > hasta:
        raise ReglaNegocio("La fecha inicial no puede ser posterior a la final.", "desde")
    return fuentes.resumen(con, u, desde, hasta)


@router.post("/fuentes", response_model=FuenteOut, status_code=status.HTTP_201_CREATED)
def crear_fuente(form: FuenteForm, u: IdUsuario, con: Con):
    return fuentes.crear(con, u, form)


@router.put("/fuentes/{id_fuente}", response_model=FuenteOut)
def actualizar_fuente(id_fuente: int, form: FuenteForm, u: IdUsuario, con: Con):
    return fuentes.actualizar(con, u, id_fuente, form)


@router.patch("/fuentes/{id_fuente}/estado", response_model=FuenteOut)
def estado_fuente(id_fuente: int, form: EstadoForm, u: IdUsuario, con: Con):
    return fuentes.cambiar_estado(con, u, id_fuente, form.activa)
