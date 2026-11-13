"""Movimientos recurrentes: Hicotea los recuerda cuando se acerca su fecha y
el usuario los confirma (con el monto real) u omite. Nunca se registran
solos. El registro pasa por el servicio de movimientos, así que aplican las
mismas reglas que cualquier ingreso o gasto."""

from sqlalchemy import Connection

from app.errores import NoEncontrado, ReglaNegocio
from app.esquemas.entradas import ConfirmacionRecurrenteForm, MovimientoForm, RecurrenteForm
from app.modelo import calculos, dinero, reloj
from app.modelo.enums import Periodicidad, TipoMovimiento
from app.repos import otros as repo
from app.servicios import cajitas, movimientos
from app.servicios.serializacion import serializar_finanzas


def _con_estado(r: dict, hoy) -> dict:
    return {
        **r,
        "pendiente": calculos.recurrente_pendiente(r["activo"], r["proxima_fecha"], r["dias_aviso"], hoy),
        "vencido": calculos.recurrente_vencido(r["proxima_fecha"], hoy),
    }


def listar(con: Connection, id_usuario: int) -> list[dict]:
    hoy = reloj.hoy()
    return [_con_estado(r, hoy) for r in repo.recurrente_listar(con, id_usuario)]


def pendientes(con: Connection, id_usuario: int) -> list[dict]:
    hoy = reloj.hoy()
    return [_con_estado(r, hoy) for r in repo.recurrente_pendientes(con, id_usuario, hoy)]


def obtener(con: Connection, id_usuario: int, id_recurrente: int) -> dict:
    r = repo.recurrente_buscar(con, id_usuario, id_recurrente)
    if r is None:
        raise NoEncontrado("Recurrente no encontrado")
    return _con_estado(r, reloj.hoy())


def crear(con: Connection, id_usuario: int, form: RecurrenteForm) -> dict:
    id_recurrente = repo.recurrente_insertar(con, id_usuario, _construir(con, id_usuario, form, None))
    return obtener(con, id_usuario, id_recurrente)


def actualizar(con: Connection, id_usuario: int, id_recurrente: int, form: RecurrenteForm) -> dict:
    obtener(con, id_usuario, id_recurrente)
    repo.recurrente_actualizar(con, id_usuario, id_recurrente, _construir(con, id_usuario, form, id_recurrente))
    return obtener(con, id_usuario, id_recurrente)


def cambiar_estado(con: Connection, id_usuario: int, id_recurrente: int, activo: bool) -> dict:
    obtener(con, id_usuario, id_recurrente)
    repo.recurrente_cambiar_estado(con, id_usuario, id_recurrente, activo)
    return obtener(con, id_usuario, id_recurrente)


def eliminar(con: Connection, id_usuario: int, id_recurrente: int) -> None:
    """Los movimientos ya registrados se conservan: no dependen del recurrente."""
    obtener(con, id_usuario, id_recurrente)
    repo.recurrente_eliminar(con, id_usuario, id_recurrente)


def confirmar(con: Connection, id_usuario: int, id_recurrente: int, conf: ConfirmacionRecurrenteForm) -> dict:
    """Registra el movimiento del periodo y programa el siguiente. Todo en una
    transacción: si el registro falla, la fecha no avanza."""
    serializar_finanzas(con, id_usuario)  # antes de leer la próxima fecha: dos confirmaciones no avanzan en paralelo
    r = obtener(con, id_usuario, id_recurrente)
    if not r["activo"]:
        raise ReglaNegocio("Este recurrente está pausado.")
    hoy = reloj.hoy()
    fecha = conf.fecha or (hoy if r["proxima_fecha"] > hoy else r["proxima_fecha"])
    monto = dinero.a_texto(r["monto"]) if dinero.es_vacio_o_cero(conf.monto) else conf.monto
    id_movimiento = movimientos.registrar(
        con,
        id_usuario,
        MovimientoForm(
            tipo=TipoMovimiento(r["tipo"]),
            fecha=fecha,
            monto=monto,
            id_categoria=r["id_categoria"],
            id_fuente=r["id_fuente"],
            id_cajita_origen=r["id_cajita_origen"],
            descripcion=r["nombre"],
        ),
    )
    _avanzar(con, id_usuario, r)
    return {**obtener(con, id_usuario, id_recurrente), "id_movimiento": id_movimiento}


def omitir(con: Connection, id_usuario: int, id_recurrente: int) -> dict:
    """Salta este periodo sin registrar nada (ej. este mes no se pagó)."""
    serializar_finanzas(con, id_usuario)
    _avanzar(con, id_usuario, obtener(con, id_usuario, id_recurrente))
    return obtener(con, id_usuario, id_recurrente)


def _avanzar(con: Connection, id_usuario: int, r: dict) -> None:
    siguiente = Periodicidad(r["periodicidad"]).siguiente(r["proxima_fecha"], r["dia_ancla"])
    repo.recurrente_actualizar_proxima(con, id_usuario, r["id"], siguiente)


def _construir(con: Connection, id_usuario: int, f: RecurrenteForm, excluido: int | None) -> dict:
    nombre = f.nombre.strip()
    if not nombre:
        raise ReglaNegocio("Escribe el nombre del recurrente.", "nombre")
    if repo.recurrente_existe_nombre(con, id_usuario, nombre, excluido):
        raise ReglaNegocio("Ya tienes un recurrente con ese nombre.", "nombre")
    if f.proxima_fecha is None:
        raise ReglaNegocio("Elige la próxima fecha.", "proxima_fecha")
    # Mismas reglas de un ingreso o gasto normal (tipo, monto, categoría, fuente).
    valido = movimientos.validar(
        con,
        id_usuario,
        MovimientoForm(
            tipo=TipoMovimiento(f.tipo), fecha=reloj.hoy(), monto=f.monto,
            id_categoria=f.id_categoria, id_fuente=f.id_fuente,
        ),
    )
    id_cajita = f.id_cajita_origen if f.tipo == TipoMovimiento.GASTO else None
    if id_cajita is not None:
        try:
            cajita = cajitas.obtener(con, id_usuario, id_cajita)
        except NoEncontrado:
            raise ReglaNegocio("Esa cajita no existe.", "id_cajita_origen")
        if not cajita["activa"]:
            raise ReglaNegocio("Esa cajita está desactivada.", "id_cajita_origen")
    return {
        "nombre": nombre,
        "tipo": valido["tipo"],
        "monto": valido["monto"],
        "id_categoria": valido["id_categoria"],
        "id_fuente": valido["id_fuente"],
        "id_cajita_origen": id_cajita,
        "periodicidad": f.periodicidad,
        "dia_ancla": f.proxima_fecha.day,
        "proxima_fecha": f.proxima_fecha,
        "dias_aviso": f.dias_aviso,
    }
