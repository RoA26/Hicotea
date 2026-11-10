"""Lógica pura, portada de los tests de Eden (DineroTest, CalculadoraRepartoTest,
PeriodicidadTest, ProgresoMetaTest, EstadoPresupuestoTest)."""

from datetime import date
from decimal import Decimal

import pytest

from app.errores import ReglaNegocio
from app.modelo import calculos, dinero
from app.modelo.enums import Periodicidad

D = Decimal

# ---------------------------------------------------------------- Dinero


@pytest.mark.parametrize(
    "texto, esperado",
    [
        ("85000", "85000.00"),
        ("85.000", "85000.00"),
        ("$ 85.000", "85000.00"),
        ("1.250.000", "1250000.00"),
        ("85.000,50", "85000.50"),
        ("12.5", "12.50"),
        ("1500,75", "1500.75"),
    ],
)
def test_interpreta_el_formato_colombiano(texto, esperado):
    assert dinero.parsear(texto, "monto") == D(esperado)


@pytest.mark.parametrize("texto", ["0", "-5000", "abc", "12.345,678", " ", "1e5", "NaN", "1_000"])
def test_rechaza_montos_invalidos(texto):
    with pytest.raises(ReglaNegocio) as e:
        dinero.parsear(texto, "monto")
    assert e.value.campo == "monto"


def test_formatea_sin_decimales_con_punto_de_miles():
    assert dinero.formatear(D("1234567.40")) == "$ 1.234.567"
    assert dinero.formatear(None) == "$ 0"
    assert dinero.formatear(D("-2500")) == "-$ 2.500"


def test_detecta_textos_vacios_o_cero():
    assert dinero.es_vacio_o_cero(None)
    assert dinero.es_vacio_o_cero("$ 0.000")
    assert not dinero.es_vacio_o_cero("20.000")


def test_a_texto_vuelve_a_ser_parseable():
    for monto in (D("85000.00"), D("1000000.00"), D("12.50")):
        assert dinero.parsear(dinero.a_texto(monto), "m") == monto


# ---------------------------------------------------------------- CalculadoraReparto


def _cajita(id_, nombre, porcentaje, resto):
    return {"id": id_, "nombre": nombre, "porcentaje": D(porcentaje), "es_resto": resto}


def test_el_resto_recibe_lo_que_sobra_incluido_el_redondeo():
    p = calculos.proponer_reparto(
        D("100001"),
        [_cajita(1, "Daniela", "50", False), _cajita(2, "Atenea", "33.33", False),
         _cajita(3, "Emergencia", "10", False), _cajita(4, "Chelas", "0", True)],
    )
    assert [l.nombre for l in p.lineas] == ["Daniela", "Atenea", "Emergencia", "Chelas"]
    assert [l.monto for l in p.lineas] == [D("50000"), D("33330"), D("10000"), D("6671")]
    assert sum(l.monto for l in p.lineas) == D("100001")
    assert p.sobrante == 0


def test_sin_cajita_resto_el_sobrante_queda_en_el_disponible():
    p = calculos.proponer_reparto(D("200000"), [_cajita(1, "Daniela", "60", False), _cajita(2, "Atenea", "30", False)])
    assert len(p.lineas) == 2
    assert p.sobrante == D("20000")


def test_monto_cero_no_genera_aportes():
    p = calculos.proponer_reparto(D(0), [_cajita(1, "Daniela", "50", False), _cajita(2, "Chelas", "0", True)])
    assert all(l.monto == 0 for l in p.lineas)
    assert p.sobrante == 0


# ---------------------------------------------------------------- Periodicidad y recurrentes


def test_mensual_conserva_el_dia_ancla_aunque_febrero_sea_mas_corto():
    febrero = Periodicidad.MENSUAL.siguiente(date(2027, 1, 31), 31)
    marzo = Periodicidad.MENSUAL.siguiente(febrero, 31)
    assert febrero == date(2027, 2, 28)
    assert marzo == date(2027, 3, 31)


def test_semanal_quincenal_y_anual():
    base = date(2026, 9, 24)
    assert Periodicidad.SEMANAL.siguiente(base, 24) == date(2026, 10, 1)
    assert Periodicidad.QUINCENAL.siguiente(base, 24) == date(2026, 10, 9)
    assert Periodicidad.ANUAL.siguiente(date(2028, 2, 29), 29) == date(2029, 2, 28)


def test_recurrente_queda_pendiente_dentro_de_los_dias_de_aviso():
    proxima = date(2026, 10, 1)
    assert not calculos.recurrente_pendiente(True, proxima, 3, date(2026, 9, 27))
    assert calculos.recurrente_pendiente(True, proxima, 3, date(2026, 9, 28))
    assert not calculos.recurrente_pendiente(False, proxima, 3, date(2026, 9, 28))
    assert calculos.recurrente_vencido(proxima, date(2026, 10, 2))


# ---------------------------------------------------------------- ProgresoMeta

HOY = date(2026, 9, 24)


def test_calcula_aporte_mensual_redondeando_hacia_arriba():
    # Faltan 1.000.000 y hay 3 meses (24 sep -> 24 dic).
    p = calculos.progreso_meta(D("500000"), D("1500000"), date(2026, 12, 24), HOY)
    assert p["porcentaje"] == 33
    assert p["faltante"] == D("1000000")
    assert p["meses_restantes"] == 3
    assert p["aporte_mensual"] == D("333334")
    assert not p["cumplida"]


def test_un_mes_parcial_cuenta_como_un_aporte_mas():
    assert calculos.progreso_meta(D(0), D("100000"), date(2026, 11, 3), HOY)["meses_restantes"] == 2


def test_meta_cumplida_no_pide_aportes_y_topa_en_cien():
    p = calculos.progreso_meta(D("150000"), D("100000"), date(2027, 1, 1), HOY)
    assert p["cumplida"]
    assert p["porcentaje"] == 100
    assert p["aporte_mensual"] is None


def test_sin_fecha_no_hay_aporte_y_fecha_pasada_es_vencida():
    assert calculos.progreso_meta(D("10000"), D("100000"), None, HOY)["aporte_mensual"] is None
    assert calculos.progreso_meta(D("10000"), D("100000"), date(2026, 9, 1), HOY)["vencida"]


# ---------------------------------------------------------------- EstadoPresupuesto


def test_alerta_desde_el_ochenta_por_ciento():
    assert not calculos.estado_presupuesto(D("500000"), D("399000"))["en_alerta"]
    assert calculos.estado_presupuesto(D("500000"), D("400000"))["en_alerta"]


def test_excedido_no_cuenta_como_alerta_y_la_barra_topa_en_cien():
    e = calculos.estado_presupuesto(D("500000"), D("650000"))
    assert e["excedido"]
    assert not e["en_alerta"]
    assert e["porcentaje"] == 130
    assert e["porcentaje_barra"] == 100
    assert e["restante"] == D("-150000")


# ---------------------------------------------------------------- ResumenFuente


def test_resumen_fuente_utilidad_promedio_y_margen():
    r = calculos.resumen_fuente(D("300000"), D("50000"), 3)
    assert r["utilidad"] == D("250000")
    assert r["promedio_diario"] == D("83333")
    assert r["margen"] == 83
    assert calculos.resumen_fuente(D(0), D(0), 0)["margen"] is None
