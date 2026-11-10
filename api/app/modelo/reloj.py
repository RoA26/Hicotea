"""Única fuente de "hoy" para las reglas de negocio (zona horaria de Colombia).

Se usa siempre como `reloj.hoy()` (no `from reloj import hoy`) para que los
tests puedan fijar la fecha con monkeypatch."""

import calendar
from datetime import date, datetime
from zoneinfo import ZoneInfo

ZONA = ZoneInfo("America/Bogota")


def hoy() -> date:
    return datetime.now(ZONA).date()


def sumar_meses(fecha: date, meses: int) -> date:
    """Como LocalDate.plusMonths: si el día no existe en el mes destino, usa el último."""
    total = fecha.year * 12 + (fecha.month - 1) + meses
    anio, mes = divmod(total, 12)
    return fecha.replace(year=anio, month=mes + 1, day=min(fecha.day, dias_del_mes(anio, mes + 1)))


def dias_del_mes(anio: int, mes: int) -> int:
    return calendar.monthrange(anio, mes)[1]


def meses_entre(desde: date, hasta: date) -> int:
    """Meses completos entre dos fechas, como ChronoUnit.MONTHS.between."""
    total = (hasta.year * 12 + hasta.month) - (desde.year * 12 + desde.month)
    dias = hasta.day - desde.day
    if total > 0 and dias < 0:
        total -= 1
    elif total < 0 and dias > 0:
        total += 1
    return total


def primer_dia(anio: int, mes: int) -> date:
    return date(anio, mes, 1)


def ultimo_dia(anio: int, mes: int) -> date:
    return date(anio, mes, dias_del_mes(anio, mes))


def texto_mes(anio: int, mes: int) -> str:
    return f"{anio:04d}-{mes:02d}"


def parsear_mes(texto: str | None) -> tuple[int, int]:
    """'2026-11' -> (2026, 11). Vacío o inválido -> mes actual."""
    if texto:
        try:
            anio, mes = (int(p) for p in texto.split("-"))
            if 1 <= mes <= 12 and 1900 <= anio <= 9999:
                return anio, mes
        except ValueError:
            pass
    h = hoy()
    return h.year, h.month
