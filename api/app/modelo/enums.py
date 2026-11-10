from datetime import date, timedelta
from enum import StrEnum

from app.modelo.reloj import dias_del_mes, sumar_meses


class TipoCategoria(StrEnum):
    """INGRESO y GASTO son movimientos personales; COSTO_OPERATIVO son los
    gastos propios de una fuente de ingreso (gasolina, repuestos, SOAT...)."""

    INGRESO = "INGRESO"
    GASTO = "GASTO"
    COSTO_OPERATIVO = "COSTO_OPERATIVO"


class TipoMovimiento(StrEnum):
    INGRESO = "INGRESO"
    GASTO = "GASTO"
    APORTE = "APORTE"
    RETIRO = "RETIRO"
    RENDIMIENTO = "RENDIMIENTO"
    SALDO_INICIAL = "SALDO_INICIAL"

    @property
    def es_ingreso_o_gasto(self) -> bool:
        return self in (TipoMovimiento.INGRESO, TipoMovimiento.GASTO)

    @property
    def es_operacion_de_cajita(self) -> bool:
        return not self.es_ingreso_o_gasto

    @property
    def entrada(self) -> bool:
        """True si, visto desde el movimiento, el dinero "entra" (se muestra en verde)."""
        return self in (
            TipoMovimiento.INGRESO,
            TipoMovimiento.RETIRO,
            TipoMovimiento.RENDIMIENTO,
            TipoMovimiento.SALDO_INICIAL,
        )


class TipoIngresoGasto(StrEnum):
    """Subconjunto para recurrentes y atajos (la BD solo admite estos dos)."""

    INGRESO = "INGRESO"
    GASTO = "GASTO"


class Frecuencia(StrEnum):
    DIARIA = "DIARIA"
    SEMANAL = "SEMANAL"
    QUINCENAL = "QUINCENAL"
    MENSUAL = "MENSUAL"


class PropositoCajita(StrEnum):
    CAPITAL = "CAPITAL"
    COMPRAS = "COMPRAS"
    EMERGENCIA = "EMERGENCIA"
    LIBRE = "LIBRE"


class Periodicidad(StrEnum):
    """Mensual y anual usan un "día ancla" para no desplazarse: un pago del 31
    cae el 28/29 en febrero y vuelve al 31 en marzo."""

    SEMANAL = "SEMANAL"
    QUINCENAL = "QUINCENAL"
    MENSUAL = "MENSUAL"
    ANUAL = "ANUAL"

    def siguiente(self, fecha: date, dia_ancla: int) -> date:
        if self is Periodicidad.SEMANAL:
            return fecha + timedelta(weeks=1)
        if self is Periodicidad.QUINCENAL:
            return fecha + timedelta(days=15)
        meses = 1 if self is Periodicidad.MENSUAL else 12
        destino = sumar_meses(fecha, meses)
        return destino.replace(day=min(dia_ancla, dias_del_mes(destino.year, destino.month)))
