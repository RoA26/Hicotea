"""Metas de ahorro (Caparazón): el progreso sale del saldo de la cajita vinculada.

Reglas (docs/decisiones-caparazon-calendario.md):
- Una cajita puede tener **como máximo una meta activa** (índice
  `uq_meta_activa_por_cajita`), así el mismo saldo no financia dos metas.
- Al archivar una meta cumplida se guarda su logro (`cumplida_en`,
  `monto_logrado`); una meta archivada con logro se muestra como cumplida
  aunque después se retire el dinero de la cajita.
"""

from sqlalchemy import Connection
from sqlalchemy.exc import IntegrityError

from app.errores import NoEncontrado, ReglaNegocio
from app.esquemas.entradas import MetaForm
from app.modelo import calculos, dinero, reloj
from app.repos import otros as repo
from app.repos import movimiento as repo_mov
from app.servicios import cajitas
from app.servicios.serializacion import serializar_finanzas

MENSAJE_UNA_META = "La cajita {cajita} ya financia la meta activa «{meta}». Archívala o elige otra cajita."


def _con_progreso(m: dict, hoy) -> dict:
    if not m["activa"] and m["cumplida_en"] is not None:
        # Logro histórico: no depende del saldo actual de la cajita.
        progreso = calculos.progreso_meta(m["monto_logrado"], m["monto_objetivo"], None, hoy)
        return {**m, **progreso, "cumplida": True, "vencida": False}
    return {**m, **calculos.progreso_meta(m["saldo_cajita"], m["monto_objetivo"], m["fecha_objetivo"], hoy)}


def listar(con: Connection, id_usuario: int) -> list[dict]:
    hoy = reloj.hoy()
    return [_con_progreso(m, hoy) for m in repo.meta_listar(con, id_usuario)]


def listar_activas(con: Connection, id_usuario: int) -> list[dict]:
    return [m for m in listar(con, id_usuario) if m["activa"]]


def obtener(con: Connection, id_usuario: int, id_meta: int) -> dict:
    m = repo.meta_buscar(con, id_usuario, id_meta)
    if m is None:
        raise NoEncontrado("Meta no encontrada")
    return _con_progreso(m, reloj.hoy())


def crear(con: Connection, id_usuario: int, form: MetaForm) -> dict:
    serializar_finanzas(con, id_usuario)
    datos = _construir(con, id_usuario, form, None)
    _validar_una_meta_activa(con, id_usuario, datos["id_cajita"], None)
    with _traducir_meta_duplicada():
        id_meta = repo.meta_insertar(con, id_usuario, datos)
    return obtener(con, id_usuario, id_meta)


def actualizar(con: Connection, id_usuario: int, id_meta: int, form: MetaForm) -> dict:
    serializar_finanzas(con, id_usuario)
    actual = obtener(con, id_usuario, id_meta)
    datos = _construir(con, id_usuario, form, id_meta)
    if actual["activa"]:
        _validar_una_meta_activa(con, id_usuario, datos["id_cajita"], id_meta)
    with _traducir_meta_duplicada():
        repo.meta_actualizar(con, id_usuario, id_meta, datos)
    return obtener(con, id_usuario, id_meta)


def cambiar_estado(con: Connection, id_usuario: int, id_meta: int, activa: bool) -> dict:
    serializar_finanzas(con, id_usuario)
    m = obtener(con, id_usuario, id_meta)
    if activa and not m["activa"]:
        _validar_una_meta_activa(con, id_usuario, m["id_cajita"], id_meta)
    if not activa and m["activa"] and m["cumplida"]:
        _guardar_logro(con, id_usuario, m)
    with _traducir_meta_duplicada():
        repo.meta_cambiar_estado(con, id_usuario, id_meta, activa)
    return obtener(con, id_usuario, id_meta)


def reconocer_logro(con: Connection, id_usuario: int, id_meta: int) -> dict:
    """Acción explícita "Celebrar y guardar el logro" (nunca automática).

    Guarda el logro (fecha de reconocimiento = hoy; fecha en que se alcanzó =
    calculada del historial) y archiva la meta para liberar la cajita. El
    dinero **se queda en la cajita**: no se registra ningún movimiento."""
    serializar_finanzas(con, id_usuario)
    m = obtener(con, id_usuario, id_meta)
    if not m["activa"]:
        raise ReglaNegocio("Esta meta ya está archivada.")
    if not m["cumplida"]:
        raise ReglaNegocio(f"Todavía faltan {dinero.formatear(m['faltante'])} para esta meta.")
    _guardar_logro(con, id_usuario, m)
    repo.meta_cambiar_estado(con, id_usuario, id_meta, False)
    return obtener(con, id_usuario, id_meta)


def _guardar_logro(con: Connection, id_usuario: int, m: dict) -> None:
    alcanzada = repo_mov.primera_fecha_con_saldo(con, id_usuario, m["id_cajita"], m["monto_objetivo"])
    repo.meta_guardar_logro(
        con, id_usuario, m["id"], reloj.hoy(), min(m["saldo_cajita"], m["monto_objetivo"]), alcanzada
    )


def eliminar(con: Connection, id_usuario: int, id_meta: int) -> None:
    """Eliminar una meta no toca el dinero: sigue en su cajita."""
    obtener(con, id_usuario, id_meta)
    repo.meta_eliminar(con, id_usuario, id_meta)


def _validar_una_meta_activa(con: Connection, id_usuario: int, id_cajita: int, excluido: int | None) -> None:
    otra = repo.meta_activa_en_cajita(con, id_usuario, id_cajita, excluido)
    if otra is not None:
        cajita = cajitas.obtener(con, id_usuario, id_cajita)
        raise ReglaNegocio(MENSAJE_UNA_META.format(cajita=cajita["nombre"], meta=otra["nombre"]), "id_cajita")


class _traducir_meta_duplicada:
    """Si dos peticiones pasan la validación a la vez, el índice único decide."""

    def __enter__(self):
        return self

    def __exit__(self, tipo, e, _tb):
        if isinstance(e, IntegrityError):
            restriccion = getattr(getattr(e.orig, "diag", None), "constraint_name", None)
            if restriccion == "uq_meta_activa_por_cajita":
                raise ReglaNegocio("Esa cajita ya financia otra meta activa.", "id_cajita") from e
        return False


def _construir(con: Connection, id_usuario: int, f: MetaForm, excluido: int | None) -> dict:
    nombre = f.nombre.strip()
    if not nombre:
        raise ReglaNegocio("Escribe el nombre de la meta.", "nombre")
    if repo.meta_existe_nombre(con, id_usuario, nombre, excluido):
        raise ReglaNegocio("Ya tienes una meta con ese nombre.", "nombre")
    # Al editar se permite una fecha ya pasada (la meta pudo vencerse).
    if f.fecha_objetivo is not None and f.fecha_objetivo <= reloj.hoy() and excluido is None:
        raise ReglaNegocio("La fecha objetivo debe ser futura.", "fecha_objetivo")
    try:
        cajita = cajitas.obtener(con, id_usuario, f.id_cajita)
    except NoEncontrado:
        raise ReglaNegocio("Esa cajita no existe.", "id_cajita")
    if not cajita["activa"]:
        raise ReglaNegocio("Esa cajita está desactivada.", "id_cajita")
    return {
        "nombre": nombre,
        "monto_objetivo": dinero.parsear(f.monto_objetivo, "monto_objetivo"),
        "fecha_objetivo": f.fecha_objetivo,
        "id_cajita": cajita["id"],
    }
