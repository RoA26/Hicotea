"""Lógica pura (sin base de datos) para poder probarla aislada:
reparto sugerido, progreso de metas, estado de presupuestos, resúmenes
y estado de recurrentes."""

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import ROUND_DOWN, ROUND_HALF_UP, ROUND_UP, Decimal

from app.modelo.dinero import CENTAVOS
from app.modelo.reloj import meses_entre, sumar_meses

CIEN = Decimal(100)
UNIDAD = Decimal(1)


# ---------------------------------------------------------------- reparto (RN-04)


@dataclass(frozen=True)
class LineaReparto:
    id_cajita: int
    nombre: str
    monto: Decimal


@dataclass(frozen=True)
class Propuesta:
    monto_a_repartir: Decimal
    lineas: list[LineaReparto]
    sobrante: Decimal


def proponer_reparto(monto: Decimal, cajitas_activas: list[dict]) -> Propuesta:
    """Cada cajita con porcentaje recibe su parte redondeada hacia abajo a
    pesos enteros; la cajita "resto" recibe todo lo que sobra, incluidos los
    pesos del redondeo. Si no hay cajita resto, lo que sobra se queda en el
    disponible."""
    lineas: list[LineaReparto] = []
    asignado = Decimal(0)
    resto = None
    for c in cajitas_activas:
        if c["es_resto"]:
            resto = c
            continue
        parte = (monto * Decimal(c["porcentaje"]) / CIEN).quantize(UNIDAD, ROUND_DOWN).quantize(CENTAVOS)
        lineas.append(LineaReparto(c["id"], c["nombre"], parte))
        asignado += parte
    sobrante = max(monto - asignado, Decimal(0)).quantize(CENTAVOS)
    if resto is not None:
        lineas.append(LineaReparto(resto["id"], resto["nombre"], sobrante))
        sobrante = Decimal(0).quantize(CENTAVOS)
    return Propuesta(monto.quantize(CENTAVOS), lineas, sobrante)


# ---------------------------------------------------------------- metas


def progreso_meta(saldo_cajita: Decimal, objetivo: Decimal, fecha_objetivo: date | None, hoy: date) -> dict:
    saldo = max(saldo_cajita, Decimal(0))
    cumplida = saldo >= objetivo
    faltante = Decimal(0) if cumplida else objetivo - saldo
    porcentaje = min(int((saldo * CIEN / objetivo).quantize(UNIDAD, ROUND_DOWN)), 100)
    meses = None
    aporte = None
    vencida = False
    if fecha_objetivo is not None:
        vencida = not cumplida and fecha_objetivo < hoy
        completos = meses_entre(hoy, fecha_objetivo)
        # Un mes parcial cuenta como mes para aportar: faltan 40 días -> 2 aportes.
        parcial = 1 if sumar_meses(hoy, completos) < fecha_objetivo else 0
        meses = max(0, completos + parcial)
        if not cumplida and meses > 0:
            aporte = (faltante / meses).quantize(UNIDAD, ROUND_UP)
    return {
        "porcentaje": porcentaje,
        "faltante": faltante,
        "meses_restantes": meses,
        "aporte_mensual": aporte,
        "cumplida": cumplida,
        "vencida": vencida,
    }


# ---------------------------------------------------------------- presupuestos

UMBRAL_ALERTA = 80


def estado_presupuesto(presupuestado: Decimal, gastado: Decimal) -> dict:
    porcentaje = int((gastado * CIEN / presupuestado).quantize(UNIDAD, ROUND_DOWN))
    excedido = gastado > presupuestado
    return {
        "porcentaje": porcentaje,
        "porcentaje_barra": min(porcentaje, 100),
        "restante": presupuestado - gastado,
        "excedido": excedido,
        "en_alerta": not excedido and porcentaje >= UMBRAL_ALERTA,
    }


# ---------------------------------------------------------------- resúmenes


def resumen_periodo(ingresos: Decimal, personales: Decimal, costos: Decimal) -> dict:
    gastos = personales + costos
    return {
        "ingresos": ingresos,
        "gastos_personales": personales,
        "costos_operativos": costos,
        "gastos_totales": gastos,
        "balance": ingresos - gastos,
    }


def resumen_fuente(bruto: Decimal, costos: Decimal, dias_trabajados: int) -> dict:
    """Estado de resultados de una fuente en un periodo (RN-02)."""
    utilidad = bruto - costos
    promedio = Decimal(0) if dias_trabajados == 0 else (utilidad / dias_trabajados).quantize(UNIDAD, ROUND_HALF_UP)
    margen = None if bruto == 0 else int((utilidad * CIEN / bruto).quantize(UNIDAD, ROUND_HALF_UP))
    return {"utilidad": utilidad, "promedio_diario": promedio, "margen": margen}


# ---------------------------------------------------------------- recurrentes


def recurrente_pendiente(activo: bool, proxima_fecha: date, dias_aviso: int, hoy: date) -> bool:
    """True si ya llegó (o está dentro de los días de aviso) su próxima fecha."""
    return activo and not (proxima_fecha - timedelta(days=dias_aviso) > hoy)


def recurrente_vencido(proxima_fecha: date, hoy: date) -> bool:
    return proxima_fecha < hoy
