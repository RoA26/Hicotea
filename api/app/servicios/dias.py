"""C-04: confirmar que un día no tuvo actividad financiera.

No es un movimiento: no toca `movimiento` ni los saldos. Se puede deshacer.
Usa la serialización por usuario (D-F3) para que la comprobación "el día no
tiene movimientos" no compita con un registro simultáneo en esa fecha.
"""

from datetime import date, timedelta

from sqlalchemy import Connection

from app.errores import ReglaNegocio
from app.modelo import reloj
from app.repos import movimiento as repo_mov
from app.repos import otros as repo
from app.servicios.serializacion import serializar_finanzas


def marcar(con: Connection, id_usuario: int, fecha: date) -> dict:
    """Idempotente: confirmar dos veces el mismo día no es un error."""
    serializar_finanzas(con, id_usuario)
    if fecha > reloj.hoy():
        raise ReglaNegocio("No se puede confirmar un día que todavía no llega.", "fecha")
    inicio = repo_mov.primera_fecha(con, id_usuario)
    if inicio is None or fecha < inicio:
        raise ReglaNegocio("Ese día es anterior a tu primer movimiento: no hace falta confirmarlo.", "fecha")
    if repo_mov.registros_del_dia(con, id_usuario, fecha) > 0:
        raise ReglaNegocio("Ese día ya tiene movimientos registrados.", "fecha")
    repo.dia_sin_actividad_marcar(con, id_usuario, fecha)
    return {"fecha": fecha, "confirmado": True}


def quitar(con: Connection, id_usuario: int, fecha: date) -> dict:
    """Deshacer la confirmación (idempotente)."""
    serializar_finanzas(con, id_usuario)
    repo.dia_sin_actividad_quitar(con, id_usuario, fecha)
    return {"fecha": fecha, "confirmado": False}


def ayer_sin_registros(con: Connection, id_usuario: int) -> bool:
    """C-05: ayer, dentro del historial, sin movimientos y sin confirmar."""
    ayer = reloj.hoy() - timedelta(days=1)
    inicio = repo_mov.primera_fecha(con, id_usuario)
    if inicio is None or ayer < inicio:
        return False
    if repo_mov.registros_del_dia(con, id_usuario, ayer) > 0:
        return False
    return ayer not in repo.dias_sin_actividad(con, id_usuario, ayer, ayer)
