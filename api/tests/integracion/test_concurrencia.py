"""D-F3 / H-04: dos operaciones de dinero simultáneas del mismo usuario no
pueden pasar las dos la validación de fondos.

Cada caso abre dos conexiones independientes a PostgreSQL: la primera hace su
operación y deja la transacción abierta; la segunda intenta lo mismo en otro
hilo. Con la serialización por usuario, la segunda debe quedar esperando hasta
que la primera confirme y entonces ver el saldo nuevo y fallar. Sin ella, la
segunda lee el saldo viejo (READ COMMITTED), pasa la validación y el saldo
queda negativo.
"""

import threading
from collections.abc import Callable

import pytest
from sqlalchemy import Connection

from app.db import motor
from app.errores import ReglaNegocio
from app.esquemas.entradas import LineaRepartoForm, MovimientoForm, OperacionCajitaForm, RepartoForm
from app.modelo.enums import TipoMovimiento
from app.repos import cajita as repo_cajita
from app.repos import movimiento as repo_mov
from app.servicios import cajitas, movimientos
from tests.integracion.conftest import HOY

ESPERA = 0.6  # segundos que la segunda operación debe seguir bloqueada


def _en_hilo(operacion: Callable[[Connection], object]):
    resultado: dict = {}

    def correr():
        with motor().connect() as con:
            try:
                resultado["valor"] = operacion(con)
                con.commit()
            except Exception as e:  # noqa: BLE001 - se inspecciona en el test
                con.rollback()
                resultado["error"] = e

    hilo = threading.Thread(target=correr, daemon=True)
    hilo.start()
    return hilo, resultado


def _carrera(primera: Callable[[Connection], object], segunda: Callable[[Connection], object]) -> dict:
    """Corre `primera` sin confirmar, lanza `segunda` en paralelo y comprueba que espera."""
    with motor().connect() as con_a:
        primera(con_a)
        hilo, resultado = _en_hilo(segunda)
        hilo.join(ESPERA)
        bloqueada = hilo.is_alive()
        con_a.commit()
    hilo.join(10)
    assert not hilo.is_alive(), "la segunda operación no terminó"
    assert bloqueada, "la segunda operación no esperó a la primera: no hay serialización por usuario"
    return resultado


def _retiro(id_usuario, id_cajita, monto):
    form = OperacionCajitaForm(operacion=TipoMovimiento.RETIRO, fecha=HOY, monto=monto)
    return lambda con: cajitas.registrar_operacion(con, id_usuario, id_cajita, form)


def _aporte(id_usuario, id_cajita, monto):
    form = OperacionCajitaForm(operacion=TipoMovimiento.APORTE, fecha=HOY, monto=monto)
    return lambda con: cajitas.registrar_operacion(con, id_usuario, id_cajita, form)


def _saldo_cajita(id_usuario, id_cajita):
    with motor().connect() as con:
        return repo_cajita.saldo(con, id_usuario, id_cajita)


def _disponible(id_usuario):
    with motor().connect() as con:
        return repo_mov.disponible(con, id_usuario)


def test_dos_retiros_simultaneos_no_dejan_la_cajita_en_negativo(ana):
    caja = ana.cajita("Viaje", saldo_inicial="100000")
    r = _carrera(_retiro(ana.id, caja["id"], "100000"), _retiro(ana.id, caja["id"], "100000"))
    assert isinstance(r.get("error"), ReglaNegocio)
    assert _saldo_cajita(ana.id, caja["id"]) == 0


def test_dos_aportes_simultaneos_no_superan_el_disponible(ana):
    ana.ingreso("100000")
    caja = ana.cajita("Viaje")
    r = _carrera(_aporte(ana.id, caja["id"], "100000"), _aporte(ana.id, caja["id"], "100000"))
    assert isinstance(r.get("error"), ReglaNegocio)
    assert _disponible(ana.id) == 0


def test_reparto_y_aporte_simultaneos_no_superan_el_disponible(ana):
    ana.ingreso("100000")
    a = ana.cajita("A")
    b = ana.cajita("B")
    reparto = RepartoForm(lineas=[LineaRepartoForm(id_cajita=a["id"], monto="100000")])
    r = _carrera(
        lambda con: cajitas.confirmar_reparto(con, ana.id, reparto),
        _aporte(ana.id, b["id"], "100000"),
    )
    assert isinstance(r.get("error"), ReglaNegocio)
    assert _disponible(ana.id) == 0


def test_dos_gastos_simultaneos_desde_la_misma_cajita(ana):
    caja = ana.cajita("Mercado", saldo_inicial="50000")
    form = MovimientoForm(tipo=TipoMovimiento.GASTO, fecha=HOY, monto="50000",
                          id_categoria=ana.cat("Alimentación"), id_cajita_origen=caja["id"])
    gasto = lambda con: movimientos.registrar(con, ana.id, form)  # noqa: E731
    r = _carrera(gasto, gasto)
    assert isinstance(r.get("error"), ReglaNegocio)
    assert _saldo_cajita(ana.id, caja["id"]) == 0


def test_la_serializacion_no_bloquea_a_otro_usuario(ana, beto):
    caja_a = ana.cajita("Viaje", saldo_inicial="100000")
    caja_b = beto.cajita("Viaje", saldo_inicial="100000")
    with motor().connect() as con_a:
        _retiro(ana.id, caja_a["id"], "100000")(con_a)
        hilo, resultado = _en_hilo(_retiro(beto.id, caja_b["id"], "100000"))
        hilo.join(5)
        termino_sin_esperar = not hilo.is_alive()
        con_a.commit()
    hilo.join(5)
    assert termino_sin_esperar, "la operación de otro usuario quedó esperando"
    assert "error" not in resultado


@pytest.mark.parametrize("activa", [False, True])
def test_desactivar_cajita_espera_al_retiro_en_curso(ana, activa):
    """Desactivar exige saldo 0: debe leerlo después de que termine la operación en curso."""
    caja = ana.cajita("Viaje", saldo_inicial="100000")
    r = _carrera(
        _retiro(ana.id, caja["id"], "100000"),
        lambda con: cajitas.cambiar_estado(con, ana.id, caja["id"], activa),
    )
    assert "error" not in r
