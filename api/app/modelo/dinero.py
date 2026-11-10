"""Conversión de montos escritos por el usuario (RN-08). Acepta la forma
colombiana: "85000", "85.000", "$ 85.000", "85.000,50". Nunca devuelve
negativos ni cero: los montos siempre son positivos y el tipo de
movimiento decide si suma o resta."""

import re
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

from app.errores import ReglaNegocio

ESCALA = 2
CENTAVOS = Decimal("0.01")
MAXIMO = Decimal("999999999999.99")
CERO = Decimal("0.00")
_MILES_CON_PUNTO = re.compile(r"^\d{1,3}(\.\d{3})+$")
_NUMERO = re.compile(r"^[+-]?(\d+\.?\d*|\.\d+)$")


def parsear(texto: str | None, campo: str) -> Decimal:
    if texto is None or str(texto).strip() == "":
        raise ReglaNegocio("Escribe un monto.", campo)
    limpio = str(texto).replace("$", "").replace(" ", "").replace(" ", "").strip()
    if "," in limpio:
        limpio = limpio.replace(".", "").replace(",", ".")
    elif _MILES_CON_PUNTO.match(limpio):
        limpio = limpio.replace(".", "")
    if not _NUMERO.match(limpio):
        raise ReglaNegocio("Escribe el monto solo con números, por ejemplo 85000 o 85.000.", campo)
    try:
        monto = Decimal(limpio)
    except InvalidOperation:
        raise ReglaNegocio("Escribe el monto solo con números, por ejemplo 85000 o 85.000.", campo)
    if monto <= 0:
        raise ReglaNegocio("El monto debe ser mayor que cero.", campo)
    if -monto.as_tuple().exponent > ESCALA:
        raise ReglaNegocio("El monto admite máximo dos decimales.", campo)
    if monto > MAXIMO:
        raise ReglaNegocio("El monto es demasiado grande.", campo)
    return monto.quantize(CENTAVOS)


def parsear_opcional(texto: str | None, campo: str) -> Decimal | None:
    return None if texto is None or str(texto).strip() == "" else parsear(texto, campo)


def es_vacio_o_cero(texto: str | None) -> bool:
    """True si el texto está vacío o solo contiene ceros (ej. "0", "0.000", "$ 0")."""
    return texto is None or re.sub(r"[^1-9]", "", str(texto)) == ""


def formatear(monto: Decimal | None) -> str:
    """Formato colombiano sin decimales: "$ 1.234.567"."""
    valor = monto if monto is not None else Decimal(0)
    entero = int(abs(valor).quantize(Decimal(1), rounding=ROUND_HALF_UP))
    texto = f"{entero:,}".replace(",", ".")
    return ("-$ " if valor < 0 else "$ ") + texto


def a_texto(monto: Decimal) -> str:
    """Monto como texto plano que `parsear` vuelve a aceptar (ej. 85000.00 -> "85000")."""
    normal = monto.normalize()
    return format(normal, "f")
