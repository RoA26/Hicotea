"""Portado de LimitadorIntentosLoginTest de Eden."""

import pytest

from app.seguridad.limitador import LimitadorIntentosLogin


class RelojManual:
    def __init__(self):
        self.ahora = 1_000_000.0

    def __call__(self):
        return self.ahora

    def avanzar(self, minutos=0, segundos=0):
        self.ahora += minutos * 60 + segundos


@pytest.fixture
def reloj():
    return RelojManual()


@pytest.fixture
def limitador(reloj):
    return LimitadorIntentosLogin(reloj)


def test_bloquea_al_quinto_fallo_y_libera_despues_de_quince_minutos(limitador, reloj):
    for _ in range(4):
        limitador.registrar_fallo("1.2.3.4", "roger")
    assert not limitador.esta_bloqueado("1.2.3.4", "roger")
    limitador.registrar_fallo("1.2.3.4", "roger")
    assert limitador.esta_bloqueado("1.2.3.4", "roger")
    reloj.avanzar(minutos=15, segundos=1)
    assert not limitador.esta_bloqueado("1.2.3.4", "roger")


def test_un_atacante_no_deja_por_fuera_al_titular_desde_otra_ip(limitador):
    for _ in range(5):
        limitador.registrar_fallo("9.9.9.9", "roger")
    assert limitador.esta_bloqueado("9.9.9.9", "roger")
    assert not limitador.esta_bloqueado("1.2.3.4", "roger")


def test_bloquea_la_ip_que_probo_veinte_usuarios_distintos(limitador):
    for i in range(20):
        limitador.registrar_fallo("9.9.9.9", f"usuario{i}")
    assert limitador.esta_bloqueado("9.9.9.9", "cualquiera")


def test_los_fallos_viejos_no_se_acumulan_y_el_exito_reinicia_el_conteo(limitador, reloj):
    for _ in range(4):
        limitador.registrar_fallo("1.2.3.4", "roger")
    reloj.avanzar(minutos=16)
    limitador.registrar_fallo("1.2.3.4", "roger")
    assert not limitador.esta_bloqueado("1.2.3.4", "roger")
    limitador.registrar_fallo("1.2.3.4", "roger")
    limitador.registrar_exito("1.2.3.4", "roger")
    for _ in range(4):
        limitador.registrar_fallo("1.2.3.4", "roger")
    assert not limitador.esta_bloqueado("1.2.3.4", "roger")
