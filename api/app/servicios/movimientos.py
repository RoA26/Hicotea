"""Reglas de ingresos y gastos: registro rápido del producido (RN-01),
coherencia entre tipo, categoría y fuente, y gastos pagados desde una
cajita (RN-06)."""

from datetime import date
from decimal import Decimal

from sqlalchemy import Connection
from sqlalchemy.exc import IntegrityError

from app.errores import NoEncontrado, ReglaNegocio
from app.esquemas.entradas import MovimientoForm, ProducidoForm
from app.modelo import dinero, reloj
from app.modelo.enums import TipoCategoria, TipoMovimiento
from app.repos import cajita as repo_cajita
from app.repos import movimiento as repo
from app.servicios import categorias, fuentes
from app.servicios.serializacion import serializar_finanzas

TAMANO_PAGINA = 30
MENSAJE_PRODUCIDO_DUPLICADO = (
    "Ya registraste el producido de esa fuente para ese día. Si quieres cambiarlo, edítalo desde Movimientos."
)
NO_EDITABLE = "Este movimiento no se puede editar; elimínalo y regístralo de nuevo."
CODIGO_DISPONIBLE_NEGATIVO = "DISPONIBLE_NEGATIVO"


# ------------------------------------------------------------------ consultas


def detallar(m: dict) -> dict:
    """Agrega los campos derivados que la web necesita para pintar el movimiento."""
    tipo = TipoMovimiento(m["tipo"])
    return {
        **m,
        "entrada": tipo.entrada,
        # Solo ingresos y gastos se editan; las operaciones de cajita se eliminan y se registran de nuevo.
        "editable": tipo.es_ingreso_o_gasto,
        # Un retiro que paga un gasto se elimina junto con ese gasto, no por separado.
        "eliminable": m["id_relacionado"] is None,
    }


def obtener(con: Connection, id_usuario: int, id_movimiento: int) -> dict:
    m = repo.buscar(con, id_usuario, id_movimiento)
    if m is None:
        raise NoEncontrado("Movimiento no encontrado")
    return detallar(m)


def buscar(
    con: Connection,
    id_usuario: int,
    *,
    desde: date | None = None,
    hasta: date | None = None,
    tipo: TipoMovimiento | None = None,
    id_categoria: int | None = None,
    id_fuente: int | None = None,
    pagina: int = 0,
) -> dict:
    """Sin fechas en el filtro, muestra el mes actual."""
    if desde is None and hasta is None:
        h = reloj.hoy()
        desde, hasta = reloj.primer_dia(h.year, h.month), reloj.ultimo_dia(h.year, h.month)
    pagina = max(pagina, 0)
    r = repo.buscar_pagina(
        con,
        id_usuario,
        desde=desde,
        hasta=hasta,
        tipo=str(tipo) if tipo else None,
        id_categoria=id_categoria,
        id_fuente=id_fuente,
        pagina=pagina,
        tamano=TAMANO_PAGINA,
    )
    return {
        "movimientos": [detallar(m) for m in r["movimientos"]],
        "pagina": pagina,
        "tamano": TAMANO_PAGINA,
        "total_registros": r["registros"],
        "total_ingresos": r["ingresos"],
        "total_gastos": r["gastos"],
        "balance": r["ingresos"] - r["gastos"],
        "hay_anterior": pagina > 0,
        "hay_siguiente": (pagina + 1) * TAMANO_PAGINA < r["registros"],
        "desde": desde,
        "hasta": hasta,
    }


# ------------------------------------------------------------------ registro rápido (RN-01)


def registrar_producido(con: Connection, id_usuario: int, form: ProducidoForm) -> int:
    serializar_finanzas(con, id_usuario)
    fuentes.obtener_activa(con, id_usuario, form.id_fuente)
    _validar_fecha(form.fecha, "fecha")
    cat_ingreso = _validar_categoria(
        con, id_usuario, form.id_categoria_ingreso, "id_categoria_ingreso", None, TipoCategoria.INGRESO
    )
    monto = dinero.parsear(form.monto, "monto")
    costo = None if dinero.es_vacio_o_cero(form.costo) else dinero.parsear(form.costo, "costo")

    id_ingreso = _insertar_controlando_duplicado(
        con,
        id_usuario,
        {"tipo": TipoMovimiento.INGRESO, "fecha": form.fecha, "monto": monto,
         "id_categoria": cat_ingreso["id"], "id_fuente": form.id_fuente},
    )
    if costo is not None:
        if form.id_categoria_costo is None:
            raise ReglaNegocio("Elige la categoría del costo.", "id_categoria_costo")
        cat_costo = _validar_categoria(
            con, id_usuario, form.id_categoria_costo, "id_categoria_costo", None, TipoCategoria.COSTO_OPERATIVO
        )
        repo.insertar(
            con,
            id_usuario,
            {"tipo": TipoMovimiento.GASTO, "fecha": form.fecha, "monto": costo,
             "id_categoria": cat_costo["id"], "id_fuente": form.id_fuente},
        )
    return id_ingreso


# ------------------------------------------------------------------ formulario general


def registrar(con: Connection, id_usuario: int, form: MovimientoForm) -> int:
    """También lo usan recurrentes y atajos: la fecha que llega es la fecha
    efectiva del movimiento (puede ser pasada, nunca futura)."""
    serializar_finanzas(con, id_usuario)
    m = validar(con, id_usuario, form)
    cajita_origen = None
    if m["tipo"] == TipoMovimiento.GASTO and form.id_cajita_origen is not None:
        cajita_origen = repo_cajita.buscar(con, id_usuario, form.id_cajita_origen)
        if cajita_origen is None:
            raise ReglaNegocio("Esa cajita no existe.", "id_cajita_origen")
        if not cajita_origen["activa"]:
            raise ReglaNegocio("Esa cajita está desactivada.", "id_cajita_origen")
        _validar_saldo_suficiente(cajita_origen, cajita_origen["saldo"], m["monto"], "id_cajita_origen")

    id_movimiento = _insertar_controlando_duplicado(con, id_usuario, m)
    if cajita_origen is not None:
        repo.insertar(
            con,
            id_usuario,
            {"tipo": TipoMovimiento.RETIRO, "fecha": m["fecha"], "monto": m["monto"],
             "id_cajita": cajita_origen["id"], "id_relacionado": id_movimiento, "descripcion": "Pago de gasto"},
        )
    return id_movimiento


def actualizar(
    con: Connection, id_usuario: int, id_movimiento: int, form: MovimientoForm, confirmar_negativo: bool = False
) -> dict:
    serializar_finanzas(con, id_usuario)
    existente = obtener(con, id_usuario, id_movimiento)
    if not existente["editable"]:
        raise ReglaNegocio(NO_EDITABLE)
    form = form.model_copy(update={"tipo": TipoMovimiento(existente["tipo"])})  # el tipo no cambia al editar
    nuevo = _construir(con, id_usuario, form, existente["id_categoria"])

    retiro = repo.buscar_relacionado(con, id_usuario, id_movimiento)
    if retiro is not None:
        cajita = repo_cajita.buscar(con, id_usuario, retiro["id_cajita"])
        if cajita is None:
            raise NoEncontrado("Cajita no encontrada")
        if not cajita["activa"] and nuevo["monto"] != retiro["monto"]:
            # D-F1: cambiar el monto movería el saldo de una cajita desactivada.
            raise ReglaNegocio(_mensaje_cajita_inactiva(cajita["nombre"], "cambiar el monto de este gasto"), "monto")
        # El monto anterior vuelve a estar disponible en la cajita para la validación.
        _validar_saldo_suficiente(cajita, cajita["saldo"] + retiro["monto"], nuevo["monto"], "monto")
    elif existente["tipo"] == TipoMovimiento.INGRESO:
        # D-F2: rebajar un ingreso es una corrección histórica que puede dejar el disponible negativo.
        _validar_correccion(con, id_usuario, nuevo["monto"] - existente["monto"], confirmar_negativo)
    try:
        with con.begin_nested():
            repo.actualizar(con, id_usuario, id_movimiento, nuevo)
    except IntegrityError as e:
        _traducir_duplicado(e)
    if retiro is not None:
        repo.actualizar_relacionado(con, id_usuario, id_movimiento, nuevo["fecha"], nuevo["monto"])
    return obtener(con, id_usuario, id_movimiento)


def eliminar(con: Connection, id_usuario: int, id_movimiento: int, confirmar_negativo: bool = False) -> None:
    serializar_finanzas(con, id_usuario)
    m = obtener(con, id_usuario, id_movimiento)
    if not m["eliminable"]:
        raise ReglaNegocio("Este retiro pagó un gasto: elimina el gasto y el retiro se eliminará con él.")
    # D-F1: nada que toque una cajita desactivada (sus operaciones, o el retiro
    # enlazado a un gasto pagado desde ella) puede volver a crearle saldo.
    id_cajita = m["id_cajita"] or m["id_cajita_origen"]
    if id_cajita is not None:
        cajita = repo_cajita.buscar(con, id_usuario, id_cajita)
        if cajita is not None and not cajita["activa"]:
            raise ReglaNegocio(_mensaje_cajita_inactiva(cajita["nombre"], "eliminar este movimiento"))
    # D-F2: efecto de la eliminación sobre el disponible.
    tipo = TipoMovimiento(m["tipo"])
    if tipo == TipoMovimiento.INGRESO or (tipo == TipoMovimiento.RETIRO and m["id_relacionado"] is None):
        _validar_correccion(con, id_usuario, -m["monto"], confirmar_negativo)
    if m["tipo"] in (TipoMovimiento.APORTE, TipoMovimiento.RENDIMIENTO, TipoMovimiento.SALDO_INICIAL):
        saldo = repo_cajita.saldo(con, id_usuario, m["id_cajita"])
        if saldo - m["monto"] < 0:
            raise ReglaNegocio(
                f"No se puede eliminar: la cajita {m['nombre_cajita']} quedaría en negativo. "
                "Primero elimina los retiros posteriores."
            )
    # Si es un gasto pagado desde una cajita, su retiro se borra en cascada (FK ON DELETE CASCADE).
    repo.eliminar(con, id_usuario, id_movimiento)


def validar(con: Connection, id_usuario: int, form: MovimientoForm) -> dict:
    """Valida un ingreso o gasto sin guardarlo. Lo usan otros servicios
    (recurrentes, atajos) para aplicar exactamente las mismas reglas."""
    return _construir(con, id_usuario, form, None)


# ------------------------------------------------------------------ validaciones


def _construir(con: Connection, id_usuario: int, f: MovimientoForm, id_categoria_actual: int | None) -> dict:
    """`id_categoria_actual` permite conservar, al editar, una categoría que ya fue desactivada."""
    if f.tipo is None or not f.tipo.es_ingreso_o_gasto:
        raise ReglaNegocio("Elige si es un ingreso o un gasto.", "tipo")
    _validar_fecha(f.fecha, "fecha")
    monto = dinero.parsear(f.monto, "monto")
    if f.tipo == TipoMovimiento.INGRESO:
        categoria = _validar_categoria(con, id_usuario, f.id_categoria, "id_categoria", id_categoria_actual, TipoCategoria.INGRESO)
    else:
        categoria = _validar_categoria(
            con, id_usuario, f.id_categoria, "id_categoria", id_categoria_actual,
            TipoCategoria.GASTO, TipoCategoria.COSTO_OPERATIVO,
        )
    id_fuente = f.id_fuente
    if categoria["tipo"] == TipoCategoria.GASTO:
        id_fuente = None  # los gastos personales no pertenecen a una fuente
    elif categoria["tipo"] == TipoCategoria.COSTO_OPERATIVO and id_fuente is None:
        raise ReglaNegocio(
            "Los costos operativos deben asociarse a una fuente (por ejemplo, el motocarro).", "id_fuente"
        )
    if id_fuente is not None:
        try:
            fuentes.obtener(con, id_usuario, id_fuente)
        except NoEncontrado:
            raise ReglaNegocio("Esa fuente no existe.", "id_fuente")
    descripcion = f.descripcion.strip() if f.descripcion and f.descripcion.strip() else None
    return {
        "tipo": f.tipo,
        "fecha": f.fecha,
        "monto": monto,
        "id_categoria": categoria["id"],
        "id_fuente": id_fuente,
        "descripcion": descripcion,
    }


def _validar_categoria(
    con: Connection, id_usuario: int, id_categoria: int | None, campo: str,
    id_categoria_actual: int | None, *tipos: TipoCategoria,
) -> dict:
    if id_categoria is None:
        raise ReglaNegocio("Elige una categoría.", campo)
    try:
        categoria = categorias.obtener(con, id_usuario, id_categoria)
    except NoEncontrado:
        raise ReglaNegocio("Esa categoría no existe.", campo)
    if categoria["tipo"] not in tipos:
        raise ReglaNegocio("Esa categoría no corresponde a este tipo de movimiento.", campo)
    if not categoria["activa"] and id_categoria != id_categoria_actual:
        raise ReglaNegocio("Esa categoría está desactivada.", campo)
    return categoria


def _validar_fecha(fecha: date | None, campo: str) -> None:
    if fecha is None:
        raise ReglaNegocio("Elige la fecha.", campo)
    if fecha > reloj.hoy():
        raise ReglaNegocio("La fecha no puede ser futura.", campo)


def _mensaje_cajita_inactiva(nombre: str, accion: str) -> str:
    return f"La cajita {nombre} está desactivada. Actívala para {accion}; así su saldo no queda escondido."


def _validar_correccion(con: Connection, id_usuario: int, efecto: Decimal, confirmado: bool) -> None:
    """D-F2: una corrección histórica (eliminar o rebajar un ingreso, eliminar
    un retiro) puede dejar el disponible negativo, porque ese dinero ya se
    repartió a las cajitas. Se permite, pero solo con confirmación explícita.
    No se crea ningún movimiento compensatorio."""
    if efecto >= 0 or confirmado:
        return
    actual = repo.disponible(con, id_usuario)
    resultante = actual + efecto
    if resultante >= 0:
        return
    faltante = -resultante
    raise ReglaNegocio(
        f"Con esta corrección tu disponible queda en {dinero.formatear(resultante)}: ese dinero ya está en tus "
        f"cajitas. Puedes continuar y luego retirar {dinero.formatear(faltante)} de una cajita para equilibrarlo.",
        estado=409,
        codigo=CODIGO_DISPONIBLE_NEGATIVO,
        datos={
            "disponible_actual": str(actual.quantize(dinero.CENTAVOS)),
            "disponible_resultante": str(resultante.quantize(dinero.CENTAVOS)),
            "faltante": str(faltante.quantize(dinero.CENTAVOS)),
        },
    )


def _validar_saldo_suficiente(cajita: dict, saldo_disponible: Decimal, monto: Decimal, campo: str) -> None:
    if saldo_disponible < monto:
        raise ReglaNegocio(f"{cajita['nombre']} solo tiene {dinero.formatear(saldo_disponible)}.", campo)


def _insertar_controlando_duplicado(con: Connection, id_usuario: int, m: dict) -> int:
    try:
        with con.begin_nested():
            return repo.insertar(con, id_usuario, m)
    except IntegrityError as e:
        _traducir_duplicado(e)


def _traducir_duplicado(e: IntegrityError):
    """RN-01: el índice único decide si ya hay producido de esa fuente ese día."""
    restriccion = getattr(getattr(e.orig, "diag", None), "constraint_name", None)
    if restriccion == "uq_ingreso_diario_por_fuente":
        raise ReglaNegocio(MENSAJE_PRODUCIDO_DUPLICADO, "fecha") from e
    raise e
