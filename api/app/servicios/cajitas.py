"""Cajitas de ahorro: porcentajes (RN-05), saldos calculados (RN-06) y
reparto del disponible (RN-03 y RN-04)."""

from decimal import Decimal

from sqlalchemy import Connection

from app.errores import NoEncontrado, ReglaNegocio
from app.esquemas.entradas import CajitaForm, OperacionCajitaForm, RepartoForm
from app.modelo import calculos, dinero, reloj
from app.modelo.enums import TipoMovimiento
from app.repos import cajita as repo
from app.repos import movimiento as repo_mov
from app.servicios.movimientos import detallar
from app.servicios.serializacion import serializar_finanzas

CIEN = Decimal(100)


# ------------------------------------------------------------------ consultas


def listar(con: Connection, id_usuario: int) -> list[dict]:
    return repo.listar(con, id_usuario)


def listar_activas(con: Connection, id_usuario: int) -> list[dict]:
    return [c for c in repo.listar(con, id_usuario) if c["activa"]]


def obtener(con: Connection, id_usuario: int, id_cajita: int) -> dict:
    c = repo.buscar(con, id_usuario, id_cajita)
    if c is None:
        raise NoEncontrado("Cajita no encontrada")
    return c


def movimientos(con: Connection, id_usuario: int, id_cajita: int) -> list[dict]:
    obtener(con, id_usuario, id_cajita)
    return [detallar(m) for m in repo_mov.listar_por_cajita(con, id_usuario, id_cajita, 50)]


def disponible(con: Connection, id_usuario: int) -> Decimal:
    return repo_mov.disponible(con, id_usuario)


# ------------------------------------------------------------------ administración


def crear(con: Connection, id_usuario: int, form: CajitaForm) -> dict:
    serializar_finanzas(con, id_usuario)  # suma de porcentajes y cajita resto única
    nombre = _nombre(form.nombre)
    _validar_nombre_unico(con, id_usuario, nombre, None)
    porcentaje = Decimal(0) if form.es_resto else form.porcentaje
    _validar_suma_porcentajes(con, id_usuario, None, porcentaje)
    saldo_inicial = None if dinero.es_vacio_o_cero(form.saldo_inicial) else dinero.parsear(form.saldo_inicial, "saldo_inicial")
    if form.es_resto:
        repo.desmarcar_resto(con, id_usuario, None)
    id_cajita = repo.insertar(con, id_usuario, nombre, str(form.proposito), porcentaje, form.es_resto, _descripcion(form))
    if saldo_inicial is not None:
        _insertar_operacion(
            con, id_usuario, id_cajita, TipoMovimiento.SALDO_INICIAL, saldo_inicial, reloj.hoy(), "Saldo que ya tenía la cajita"
        )
    return obtener(con, id_usuario, id_cajita)


def actualizar(con: Connection, id_usuario: int, id_cajita: int, form: CajitaForm) -> dict:
    serializar_finanzas(con, id_usuario)
    cajita = obtener(con, id_usuario, id_cajita)
    nombre = _nombre(form.nombre)
    _validar_nombre_unico(con, id_usuario, nombre, id_cajita)
    porcentaje = Decimal(0) if form.es_resto else form.porcentaje
    if cajita["activa"]:
        _validar_suma_porcentajes(con, id_usuario, id_cajita, porcentaje)
    if form.es_resto:
        repo.desmarcar_resto(con, id_usuario, id_cajita)
    repo.actualizar(con, id_usuario, id_cajita, nombre, str(form.proposito), porcentaje, form.es_resto, _descripcion(form))
    return obtener(con, id_usuario, id_cajita)


def cambiar_estado(con: Connection, id_usuario: int, id_cajita: int, activa: bool) -> dict:
    serializar_finanzas(con, id_usuario)  # "saldo 0 para desactivar" se lee después de cualquier operación en curso
    cajita = obtener(con, id_usuario, id_cajita)
    if not activa and cajita["saldo"] != 0:
        raise ReglaNegocio(
            f"Para desactivar {cajita['nombre']} primero retira su saldo ({dinero.formatear(cajita['saldo'])})."
        )
    if activa:
        _validar_suma_porcentajes(con, id_usuario, id_cajita, cajita["porcentaje"])
        if cajita["es_resto"]:
            repo.desmarcar_resto(con, id_usuario, id_cajita)
    repo.cambiar_estado(con, id_usuario, id_cajita, activa)
    return obtener(con, id_usuario, id_cajita)


# ------------------------------------------------------------------ operaciones


def registrar_operacion(con: Connection, id_usuario: int, id_cajita: int, form: OperacionCajitaForm) -> int:
    serializar_finanzas(con, id_usuario)  # antes de leer saldo y disponible
    cajita = obtener(con, id_usuario, id_cajita)
    if not cajita["activa"]:
        raise ReglaNegocio("La cajita está desactivada.")
    operacion = form.operacion
    if operacion is None or not operacion.es_operacion_de_cajita:
        raise ReglaNegocio("Elige una operación válida.", "operacion")
    if form.fecha is None:
        raise ReglaNegocio("Elige la fecha.", "fecha")
    if form.fecha > reloj.hoy():
        raise ReglaNegocio("La fecha no puede ser futura.", "fecha")
    monto = dinero.parsear(form.monto, "monto")
    if operacion == TipoMovimiento.APORTE:
        disp = disponible(con, id_usuario)
        if disp < monto:
            raise ReglaNegocio(
                f"Solo tienes {dinero.formatear(disp)} disponible por repartir. Si ese dinero ya estaba en la "
                'cajita antes de usar Hicotea, regístralo como "Saldo que ya tenía".',
                "monto",
            )
    elif operacion == TipoMovimiento.RETIRO and cajita["saldo"] < monto:
        raise ReglaNegocio(f"{cajita['nombre']} solo tiene {dinero.formatear(cajita['saldo'])}.", "monto")
    descripcion = form.descripcion.strip() if form.descripcion and form.descripcion.strip() else None
    return _insertar_operacion(con, id_usuario, id_cajita, operacion, monto, form.fecha, descripcion)


# ------------------------------------------------------------------ reparto (RN-03, RN-04)


def proponer_reparto(con: Connection, id_usuario: int, monto_texto: str | None) -> dict:
    """`monto_texto` vacío = repartir todo el disponible."""
    disp = disponible(con, id_usuario)
    tope = max(disp, Decimal(0))
    monto = tope if dinero.es_vacio_o_cero(monto_texto) else dinero.parsear(monto_texto, "monto")
    if monto > tope:
        raise ReglaNegocio(f"No puedes repartir más de lo disponible ({dinero.formatear(disp)}).", "monto")
    activas = listar_activas(con, id_usuario)
    suma = sum((c["porcentaje"] for c in activas if not c["es_resto"]), Decimal(0))
    propuesta = calculos.proponer_reparto(monto, activas)
    return {
        "disponible": disp,
        "monto_a_repartir": propuesta.monto_a_repartir,
        "lineas": [vars(l) for l in propuesta.lineas],
        "sobrante": propuesta.sobrante,
        "suma_porcentajes": suma,
        "hay_resto": any(c["es_resto"] for c in activas),
        "porcentajes_incompletos": suma < CIEN,
    }


def confirmar_reparto(con: Connection, id_usuario: int, form: RepartoForm) -> Decimal:
    """Crea todos los aportes del reparto en una sola transacción: o todos o ninguno."""
    serializar_finanzas(con, id_usuario)
    activas = {c["id"]: c for c in listar_activas(con, id_usuario)}
    aportes: list[tuple[dict, Decimal]] = []
    for linea in form.lineas:
        if dinero.es_vacio_o_cero(linea.monto):
            continue
        cajita = activas.get(linea.id_cajita)
        if cajita is None:
            raise ReglaNegocio("Una de las cajitas del reparto ya no está activa. Vuelve a cargar el reparto.")
        try:
            monto = dinero.parsear(linea.monto, "monto")
        except ReglaNegocio as e:
            raise ReglaNegocio(f"Revisa el monto de {cajita['nombre']}: {e.mensaje}")
        aportes.append((cajita, monto))
    if not aportes:
        raise ReglaNegocio("Asigna un monto al menos a una cajita.")
    total = sum((m for _, m in aportes), Decimal(0))
    disp = disponible(con, id_usuario)
    if total > disp:
        raise ReglaNegocio(
            f"El reparto suma {dinero.formatear(total)} y solo tienes {dinero.formatear(disp)} disponible."
        )
    hoy = reloj.hoy()
    for cajita, monto in aportes:
        _insertar_operacion(con, id_usuario, cajita["id"], TipoMovimiento.APORTE, monto, hoy, "Reparto")
    return total


# ------------------------------------------------------------------ utilidades


def _descripcion(form: CajitaForm) -> str | None:
    d = (form.descripcion or "").strip()
    return d or None


def movimientos_de_ahorro(con: Connection, id_usuario: int, cantidad: int = 100) -> list[dict]:
    """Historial del Caparazón: operaciones de todas las cajitas (incluidas las archivadas)."""
    return [detallar(m) for m in repo_mov.listar_de_cajitas(con, id_usuario, cantidad)]


def _nombre(nombre: str) -> str:
    nombre = nombre.strip()
    if not nombre:
        raise ReglaNegocio("Escribe el nombre de la cajita.", "nombre")
    return nombre


def _validar_suma_porcentajes(con: Connection, id_usuario: int, excluido: int | None, nuevo: Decimal) -> None:
    suma = sum(
        (c["porcentaje"] for c in listar_activas(con, id_usuario) if not c["es_resto"] and c["id"] != excluido),
        Decimal(0),
    ) + nuevo
    if suma > CIEN:
        raise ReglaNegocio(
            f"Con este porcentaje tus cajitas sumarían {dinero.a_texto(suma)}%. El máximo es 100%.", "porcentaje"
        )


def _validar_nombre_unico(con: Connection, id_usuario: int, nombre: str, excluido: int | None) -> None:
    if repo.existe_nombre(con, id_usuario, nombre, excluido):
        raise ReglaNegocio("Ya tienes una cajita con ese nombre.", "nombre")


def _insertar_operacion(con, id_usuario, id_cajita, tipo, monto, fecha, descripcion) -> int:
    return repo_mov.insertar(
        con,
        id_usuario,
        {"tipo": tipo, "fecha": fecha, "monto": monto, "id_cajita": id_cajita, "descripcion": descripcion},
    )
