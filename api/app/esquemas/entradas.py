"""Formularios de entrada (equivalen a los *Form de Eden). Los montos llegan
como texto y los interpreta `dinero.parsear` en el servicio (RN-08), así el
usuario puede escribir "85.000" o "$ 85.000,50"."""

from datetime import date
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, BeforeValidator, Field

from app.modelo.enums import (
    Frecuencia,
    Periodicidad,
    PropositoCajita,
    TipoCategoria,
    TipoIngresoGasto,
    TipoMovimiento,
)


def _a_texto(v):
    if isinstance(v, bool):
        return v
    if isinstance(v, (int, float, Decimal)):
        return str(v)
    return v


TextoMonto = Annotated[str, BeforeValidator(_a_texto), Field(max_length=30)]
Nombre = Annotated[str, Field(min_length=1)]


class EstadoForm(BaseModel):
    activa: bool


class CategoriaForm(BaseModel):
    nombre: Annotated[Nombre, Field(max_length=50)]
    tipo: TipoCategoria


class CategoriaCambio(BaseModel):
    """Renombrar, activar/desactivar, o ambas."""

    nombre: Annotated[str, Field(max_length=50)] | None = None
    activa: bool | None = None


class FuenteForm(BaseModel):
    nombre: Annotated[Nombre, Field(max_length=60)]
    frecuencia: Frecuencia


class MovimientoForm(BaseModel):
    tipo: TipoMovimiento | None = None
    fecha: date | None = None
    monto: TextoMonto | None = None
    id_categoria: int | None = None
    id_fuente: int | None = None
    id_cajita_origen: int | None = None
    descripcion: Annotated[str, Field(max_length=200)] | None = None


class ProducidoForm(BaseModel):
    """Registro rápido del día (RN-01): ingreso de una fuente y, opcional, su costo."""

    id_fuente: int
    fecha: date | None = None
    monto: TextoMonto | None = None
    id_categoria_ingreso: int | None = None
    costo: TextoMonto | None = None
    id_categoria_costo: int | None = None


class MetaNuevaForm(BaseModel):
    """Meta opcional que se crea junto con la cajita (misma transacción)."""

    nombre: Annotated[str, Field(max_length=60)] | None = None  # vacío = nombre de la cajita
    monto_objetivo: TextoMonto | None = None
    fecha_objetivo: date | None = None


class CajitaForm(BaseModel):
    nombre: Annotated[Nombre, Field(max_length=40)]
    descripcion: Annotated[str, Field(max_length=200)] | None = None
    proposito: PropositoCajita
    porcentaje: Annotated[Decimal, Field(ge=0, le=100, decimal_places=2)] = Decimal(0)
    es_resto: bool = False
    saldo_inicial: TextoMonto | None = None
    meta: MetaNuevaForm | None = None  # solo al crear


class OperacionCajitaForm(BaseModel):
    operacion: TipoMovimiento | None = None
    fecha: date | None = None
    monto: TextoMonto | None = None
    descripcion: Annotated[str, Field(max_length=200)] | None = None


class LineaRepartoForm(BaseModel):
    id_cajita: int
    monto: TextoMonto | None = None


class RepartoForm(BaseModel):
    lineas: list[LineaRepartoForm]


class MetaForm(BaseModel):
    nombre: Annotated[Nombre, Field(max_length=60)]
    monto_objetivo: TextoMonto | None = None
    fecha_objetivo: date | None = None
    id_cajita: int


class PresupuestoForm(BaseModel):
    id_categoria: int
    monto: TextoMonto | None = None


class RecurrenteForm(BaseModel):
    nombre: Annotated[Nombre, Field(max_length=60)]
    tipo: TipoIngresoGasto
    monto: TextoMonto | None = None
    id_categoria: int | None = None
    id_fuente: int | None = None
    id_cajita_origen: int | None = None
    periodicidad: Periodicidad
    proxima_fecha: date | None = None
    dias_aviso: Annotated[int, Field(ge=0, le=30)] = 3


class ConfirmacionRecurrenteForm(BaseModel):
    fecha: date | None = None
    monto: TextoMonto | None = None


class AtajoForm(BaseModel):
    nombre: Annotated[str, Field(max_length=30)] = ""
    tipo: TipoIngresoGasto
    monto: TextoMonto | None = None
    id_categoria: int | None = None
    id_fuente: int | None = None


class CompartirForm(BaseModel):
    nombre_usuario: Annotated[str, Field(min_length=1, max_length=30)]


class UsoAtajoForm(BaseModel):
    """C-03: usar un atajo en una fecha pasada (registro retrospectivo). Sin fecha = hoy."""

    fecha: date | None = None
