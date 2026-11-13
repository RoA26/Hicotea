"""Respuestas de la API (equivalen a los DTO de Eden). Los montos son Decimal
y salen en JSON como string exacto ("85000.00"); la web los formatea."""

from datetime import date
from decimal import Decimal

from typing import Annotated

from pydantic import BaseModel, PlainSerializer

from app.modelo.enums import (
    Frecuencia,
    Periodicidad,
    PropositoCajita,
    TipoCategoria,
    TipoIngresoGasto,
    TipoMovimiento,
)


# Todo monto sale con exactamente dos decimales ("0.00", "85000.00"), venga de la BD o de un cálculo.
Dinero = Annotated[Decimal, PlainSerializer(lambda d: str(d.quantize(Decimal("0.01"))), return_type=str)]


class Mensaje(BaseModel):
    mensaje: str


class CategoriaOut(BaseModel):
    id: int
    nombre: str
    tipo: TipoCategoria
    activa: bool


class FuenteOut(BaseModel):
    id: int
    nombre: str
    frecuencia: Frecuencia
    activa: bool
    fecha_creacion: date


class MovimientoOut(BaseModel):
    id: int
    tipo: TipoMovimiento
    fecha: date
    monto: Dinero
    id_categoria: int | None
    id_fuente: int | None
    id_cajita: int | None
    id_relacionado: int | None
    descripcion: str | None
    nombre_categoria: str | None
    tipo_categoria: TipoCategoria | None
    nombre_fuente: str | None
    nombre_cajita: str | None
    id_cajita_origen: int | None
    nombre_cajita_origen: str | None
    entrada: bool
    editable: bool
    eliminable: bool


class PaginaMovimientos(BaseModel):
    movimientos: list[MovimientoOut]
    pagina: int
    tamano: int
    total_registros: int
    total_ingresos: Dinero
    total_gastos: Dinero
    balance: Dinero
    hay_anterior: bool
    hay_siguiente: bool
    desde: date | None
    hasta: date | None


class ResumenPeriodo(BaseModel):
    ingresos: Dinero
    gastos_personales: Dinero
    costos_operativos: Dinero
    gastos_totales: Dinero
    balance: Dinero


class ResumenFuente(BaseModel):
    id_fuente: int
    nombre: str
    activa: bool = True  # una fuente inactiva aparece si tuvo movimientos en el periodo (D-F4)
    bruto: Dinero
    costos: Dinero
    dias_trabajados: int
    utilidad: Dinero
    promedio_diario: Dinero
    margen: int | None


class CajitaInactivaConSaldo(BaseModel):
    """D-F1: dinero en una cajita desactivada (inconsistencia histórica). Se cuenta y se avisa."""

    id: int
    nombre: str
    saldo: Dinero


class Saldo(BaseModel):
    disponible: Dinero
    en_cajitas: Dinero  # incluye cajitas inactivas con saldo (D-F1)
    total: Dinero
    mes: ResumenPeriodo
    cajitas_inactivas_con_saldo: list[CajitaInactivaConSaldo] = []


class RespuestaConSaldo(BaseModel):
    """Tras un registro rápido o un "Deshacer": mensaje + saldo para animar el contador."""

    mensaje: str
    id_movimiento: int | None = None
    tipo: TipoMovimiento | None = None
    saldo: Saldo


class CajitaOut(BaseModel):
    id: int
    nombre: str
    descripcion: str | None = None
    proposito: PropositoCajita
    porcentaje: Dinero
    es_resto: bool
    activa: bool
    saldo: Dinero


class LineaRepartoOut(BaseModel):
    id_cajita: int
    nombre: str
    monto: Dinero


class PropuestaRepartoOut(BaseModel):
    disponible: Dinero
    monto_a_repartir: Dinero
    lineas: list[LineaRepartoOut]
    sobrante: Dinero
    suma_porcentajes: Dinero
    hay_resto: bool
    porcentajes_incompletos: bool


class RepartoConfirmado(BaseModel):
    mensaje: str
    total: Dinero


class MetaOut(BaseModel):
    id: int
    nombre: str
    monto_objetivo: Dinero
    fecha_objetivo: date | None
    id_cajita: int
    nombre_cajita: str
    saldo_cajita: Dinero
    activa: bool
    porcentaje: int
    faltante: Dinero
    meses_restantes: int | None
    aporte_mensual: Dinero | None
    cumplida: bool
    vencida: bool
    cajita_activa: bool = True
    cumplida_en: date | None = None  # fecha de RECONOCIMIENTO del logro (al celebrarlo o archivarlo cumplida)
    alcanzada_en: date | None = None  # primera fecha en que el saldo llegó al objetivo (según el historial)
    monto_logrado: Dinero | None = None


class PresupuestoOut(BaseModel):
    id: int
    id_categoria: int
    categoria: str
    tipo_categoria: TipoCategoria
    presupuestado: Dinero
    gastado: Dinero
    porcentaje: int
    porcentaje_barra: int
    restante: Dinero
    excedido: bool
    en_alerta: bool


class PresupuestosDelMes(BaseModel):
    mes: str
    presupuestos: list[PresupuestoOut]
    total_presupuestado: Dinero
    total_gastado: Dinero


class RecurrenteOut(BaseModel):
    id: int
    nombre: str
    tipo: TipoMovimiento
    monto: Dinero
    id_categoria: int
    id_fuente: int | None
    id_cajita_origen: int | None
    periodicidad: Periodicidad
    dia_ancla: int
    proxima_fecha: date
    dias_aviso: int
    activo: bool
    nombre_categoria: str
    nombre_fuente: str | None
    nombre_cajita_origen: str | None
    pendiente: bool
    vencido: bool


class AtajoOut(BaseModel):
    id: int
    nombre: str
    tipo: TipoMovimiento
    monto: Dinero
    id_categoria: int
    id_fuente: int | None
    nombre_categoria: str


class AccesoOut(BaseModel):
    id: int
    id_titular: int
    nombre_completo_titular: str
    id_invitado: int
    nombre_usuario_invitado: str
    nombre_completo_invitado: str
    fecha_concesion: date


class TotalMes(BaseModel):
    mes: str
    ingresos: Dinero
    gastos: Dinero


class TotalCategoria(BaseModel):
    id_categoria: int
    categoria: str
    tipo: TipoCategoria
    total: Dinero


class ProducidoDia(BaseModel):
    dia: int
    total: Dinero


class Graficas(BaseModel):
    por_mes: list[TotalMes]
    gastos_por_categoria: list[TotalCategoria]
    producido_por_dia: list[ProducidoDia]


class Tablero(BaseModel):
    hoy: date
    mes: str
    disponible: Dinero
    total_cajitas: Dinero  # incluye cajitas inactivas con saldo (D-F1)
    saldo_total: Dinero
    cajitas_inactivas_con_saldo: list[CajitaInactivaConSaldo] = []
    mes_actual: ResumenPeriodo
    mes_anterior: ResumenPeriodo
    cajitas: list[CajitaOut]
    fuentes: list[ResumenFuente]
    ultimos_movimientos: list[MovimientoOut]
    sin_movimientos: bool
    graficas: Graficas
    pendientes: list[RecurrenteOut]
    alertas_presupuesto: list[PresupuestoOut]
    metas: list[MetaOut]
    ayer_sin_registros: bool = False  # C-05: recordatorio discreto en Inicio


class CompromisoPrevisto(BaseModel):
    """Recurrente activo cuya próxima fecha cae ese día (aún no registrado)."""

    id: int
    nombre: str
    tipo: TipoIngresoGasto
    monto: Dinero


class DiaCalendario(BaseModel):
    fecha: date
    del_mes: bool
    hoy: bool
    futuro: bool = False
    ingresos: Dinero
    gastos: Dinero
    # Operaciones de ahorro: flujos internos entre el disponible y las cajitas, no ingresos ni gastos.
    aportes: Dinero = Decimal(0)
    retiros: Dinero = Decimal(0)
    rendimientos: Dinero = Decimal(0)  # incluye "saldo que ya tenía"
    operaciones_ahorro: int = 0
    registros: int = 0
    sin_registros: bool = False  # pasado, desde el comienzo del historial, sin ningún registro
    sin_actividad: bool = False  # confirmado por el usuario como día sin actividad (C-04)
    compromisos: list[CompromisoPrevisto] = []
    con_producido: bool
    sin_producido: bool


class MesCalendario(BaseModel):
    mes: str
    mes_anterior: str
    mes_siguiente: str
    semanas: list[list[DiaCalendario]]
    total_ingresos: Dinero
    total_gastos: Dinero
    dias_con_producido: int
    dias_sin_producido: int
    hoy: date | None = None
    inicio_historial: date | None = None


class DiaSinActividadOut(BaseModel):
    fecha: date
    confirmado: bool
