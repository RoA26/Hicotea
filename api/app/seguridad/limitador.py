"""Frena los ataques de fuerza bruta contra el inicio de sesión.

Dos contadores en memoria:
 - por IP + usuario: 5 fallos en 15 minutos bloquean esa combinación 15 minutos;
 - por IP: 20 fallos (cualquier usuario) bloquean esa IP 15 minutos.
Bloquear por IP + usuario, y no solo por usuario, evita que un extraño deje
por fuera al titular de la cuenta escribiendo mal su clave.

Al estar en memoria, un reinicio limpia los contadores; para una app de una
sola instancia es suficiente."""

import threading
import time
from collections.abc import Callable
from dataclasses import dataclass

MAXIMO_POR_USUARIO_E_IP = 5
MAXIMO_POR_IP = 20
VENTANA = 15 * 60
BLOQUEO = 15 * 60
LIMITE_REGISTROS_ANTES_DE_LIMPIAR = 10_000


@dataclass
class _Registro:
    fallos: int
    inicio_ventana: float
    bloqueado_hasta: float | None


class LimitadorIntentosLogin:
    def __init__(
        self,
        reloj: Callable[[], float] = time.monotonic,
        maximo_por_usuario: int = MAXIMO_POR_USUARIO_E_IP,
        maximo_por_ip: int = MAXIMO_POR_IP,
    ):
        self._reloj = reloj
        self._max_usuario = maximo_por_usuario
        self._max_ip = maximo_por_ip
        self._registros: dict[str, _Registro] = {}
        self._candado = threading.Lock()

    def esta_bloqueado(self, ip: str, usuario: str) -> bool:
        ahora = self._reloj()
        with self._candado:
            return self._bloqueado(_clave_usuario(ip, usuario), ahora) or self._bloqueado(_clave_ip(ip), ahora)

    def registrar_fallo(self, ip: str, usuario: str) -> None:
        ahora = self._reloj()
        with self._candado:
            self._limpiar_si_hace_falta(ahora)
            self._sumar_fallo(_clave_usuario(ip, usuario), self._max_usuario, ahora)
            self._sumar_fallo(_clave_ip(ip), self._max_ip, ahora)

    def registrar_exito(self, ip: str, usuario: str) -> None:
        """Un inicio de sesión correcto borra los fallos de esa combinación IP + usuario."""
        with self._candado:
            self._registros.pop(_clave_usuario(ip, usuario), None)

    def reiniciar(self) -> None:
        with self._candado:
            self._registros.clear()

    def _bloqueado(self, clave: str, ahora: float) -> bool:
        r = self._registros.get(clave)
        return r is not None and r.bloqueado_hasta is not None and ahora < r.bloqueado_hasta

    def _sumar_fallo(self, clave: str, maximo: int, ahora: float) -> None:
        actual = self._registros.get(clave)
        vencida = actual is None or ahora > actual.inicio_ventana + VENTANA
        fallos = 1 if vencida else actual.fallos + 1
        inicio = ahora if vencida else actual.inicio_ventana
        bloqueo = ahora + BLOQUEO if fallos >= maximo else (None if actual is None else actual.bloqueado_hasta)
        self._registros[clave] = _Registro(fallos, inicio, bloqueo)

    def _limpiar_si_hace_falta(self, ahora: float) -> None:
        """Evita que la memoria crezca sin límite si llegan muchas IP distintas."""
        if len(self._registros) < LIMITE_REGISTROS_ANTES_DE_LIMPIAR:
            return
        self._registros = {
            k: r for k, r in self._registros.items()
            if not (ahora > r.inicio_ventana + VENTANA and (r.bloqueado_hasta is None or ahora > r.bloqueado_hasta))
        }


def _clave_usuario(ip: str, usuario: str) -> str:
    return f"u|{ip}|{usuario}"


def _clave_ip(ip: str) -> str:
    return f"ip|{ip}"


limitador = LimitadorIntentosLogin()

# Recuperación de contraseña, en dos contadores:
#  - solicitudes de PIN: 5 por cuenta e IP y 15 por IP cada 15 minutos (frena
#    el abuso del envío de correos y el ruido en el log);
#  - PIN incorrectos: 10 por cuenta e IP y 30 por IP. Es un tope entre PIN
#    distintos; el límite por PIN (5 intentos) sigue en la base de datos.
limitador_recuperacion = LimitadorIntentosLogin(maximo_por_usuario=5, maximo_por_ip=15)
limitador_pin = LimitadorIntentosLogin(maximo_por_usuario=10, maximo_por_ip=30)

# Registro: solo cuentan los intentos fallidos (código o invitación inválidos).
limitador_registro = LimitadorIntentosLogin(maximo_por_usuario=10, maximo_por_ip=10)


def reiniciar_todos() -> None:
    for x in (limitador, limitador_recuperacion, limitador_pin, limitador_registro):
        x.reiniciar()
