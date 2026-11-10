"""Cajitas (con reparto), metas, presupuestos y recurrentes."""

from fastapi import APIRouter, status

from app.esquemas.entradas import (
    CajitaForm,
    ConfirmacionRecurrenteForm,
    EstadoForm,
    MetaForm,
    OperacionCajitaForm,
    PresupuestoForm,
    RecurrenteForm,
    RepartoForm,
)
from app.esquemas.salidas import (
    CajitaOut,
    MetaOut,
    MovimientoOut,
    PresupuestosDelMes,
    PropuestaRepartoOut,
    RecurrenteOut,
    RepartoConfirmado,
    RespuestaConSaldo,
)
from app.modelo import dinero, reloj
from app.rutas.movimientos import con_saldo
from app.seguridad.dependencias import Con, IdUsuario
from app.servicios import cajitas, metas, presupuestos, recurrentes

router = APIRouter(prefix="/api", tags=["ahorro"])


# ------------------------------------------------------------------ cajitas


@router.get("/cajitas", response_model=list[CajitaOut])
def listar_cajitas(u: IdUsuario, con: Con):
    return cajitas.listar(con, u)


@router.get("/cajitas/reparto", response_model=PropuestaRepartoOut)
def proponer_reparto(u: IdUsuario, con: Con, monto: str | None = None):
    """Reparto sugerido del disponible según los porcentajes. Sin monto: todo el disponible."""
    return cajitas.proponer_reparto(con, u, monto)


@router.post("/cajitas/reparto", response_model=RepartoConfirmado)
def confirmar_reparto(form: RepartoForm, u: IdUsuario, con: Con):
    total = cajitas.confirmar_reparto(con, u, form)
    return {"mensaje": f"Repartiste {dinero.formatear(total)}.", "total": total}


@router.get("/cajitas/{id_cajita}", response_model=CajitaOut)
def obtener_cajita(id_cajita: int, u: IdUsuario, con: Con):
    return cajitas.obtener(con, u, id_cajita)


@router.get("/cajitas/{id_cajita}/movimientos", response_model=list[MovimientoOut])
def movimientos_cajita(id_cajita: int, u: IdUsuario, con: Con):
    return cajitas.movimientos(con, u, id_cajita)


@router.post("/cajitas", response_model=CajitaOut, status_code=status.HTTP_201_CREATED)
def crear_cajita(form: CajitaForm, u: IdUsuario, con: Con):
    return cajitas.crear(con, u, form)


@router.put("/cajitas/{id_cajita}", response_model=CajitaOut)
def actualizar_cajita(id_cajita: int, form: CajitaForm, u: IdUsuario, con: Con):
    return cajitas.actualizar(con, u, id_cajita, form)


@router.patch("/cajitas/{id_cajita}/estado", response_model=CajitaOut)
def estado_cajita(id_cajita: int, form: EstadoForm, u: IdUsuario, con: Con):
    return cajitas.cambiar_estado(con, u, id_cajita, form.activa)


@router.post("/cajitas/{id_cajita}/operaciones", response_model=RespuestaConSaldo, status_code=status.HTTP_201_CREATED)
def operacion_cajita(id_cajita: int, form: OperacionCajitaForm, u: IdUsuario, con: Con):
    """Aporte, retiro, rendimiento o saldo inicial."""
    id_movimiento = cajitas.registrar_operacion(con, u, id_cajita, form)
    return con_saldo(con, u, "Operación registrada.", id_movimiento, form.operacion)


# ------------------------------------------------------------------ metas


@router.get("/metas", response_model=list[MetaOut])
def listar_metas(u: IdUsuario, con: Con):
    return metas.listar(con, u)


@router.get("/metas/{id_meta}", response_model=MetaOut)
def obtener_meta(id_meta: int, u: IdUsuario, con: Con):
    return metas.obtener(con, u, id_meta)


@router.post("/metas", response_model=MetaOut, status_code=status.HTTP_201_CREATED)
def crear_meta(form: MetaForm, u: IdUsuario, con: Con):
    return metas.crear(con, u, form)


@router.put("/metas/{id_meta}", response_model=MetaOut)
def actualizar_meta(id_meta: int, form: MetaForm, u: IdUsuario, con: Con):
    return metas.actualizar(con, u, id_meta, form)


@router.patch("/metas/{id_meta}/estado", response_model=MetaOut)
def estado_meta(id_meta: int, form: EstadoForm, u: IdUsuario, con: Con):
    return metas.cambiar_estado(con, u, id_meta, form.activa)


@router.delete("/metas/{id_meta}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_meta(id_meta: int, u: IdUsuario, con: Con):
    metas.eliminar(con, u, id_meta)


# ------------------------------------------------------------------ presupuestos


@router.get("/presupuestos", response_model=PresupuestosDelMes)
def listar_presupuestos(u: IdUsuario, con: Con, mes: str | None = None):
    return presupuestos.del_mes(con, u, *reloj.parsear_mes(mes))


@router.put("/presupuestos", response_model=PresupuestosDelMes)
def guardar_presupuesto(form: PresupuestoForm, u: IdUsuario, con: Con):
    """Crea o reemplaza el presupuesto de una categoría; devuelve los del mes actual."""
    presupuestos.guardar(con, u, form)
    return presupuestos.del_mes(con, u, *reloj.parsear_mes(None))


@router.delete("/presupuestos/{id_presupuesto}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_presupuesto(id_presupuesto: int, u: IdUsuario, con: Con):
    presupuestos.eliminar(con, u, id_presupuesto)


# ------------------------------------------------------------------ recurrentes


@router.get("/recurrentes", response_model=list[RecurrenteOut])
def listar_recurrentes(u: IdUsuario, con: Con):
    return recurrentes.listar(con, u)


@router.get("/recurrentes/pendientes", response_model=list[RecurrenteOut])
def recurrentes_pendientes(u: IdUsuario, con: Con):
    return recurrentes.pendientes(con, u)


@router.get("/recurrentes/{id_recurrente}", response_model=RecurrenteOut)
def obtener_recurrente(id_recurrente: int, u: IdUsuario, con: Con):
    return recurrentes.obtener(con, u, id_recurrente)


@router.post("/recurrentes", response_model=RecurrenteOut, status_code=status.HTTP_201_CREATED)
def crear_recurrente(form: RecurrenteForm, u: IdUsuario, con: Con):
    return recurrentes.crear(con, u, form)


@router.put("/recurrentes/{id_recurrente}", response_model=RecurrenteOut)
def actualizar_recurrente(id_recurrente: int, form: RecurrenteForm, u: IdUsuario, con: Con):
    return recurrentes.actualizar(con, u, id_recurrente, form)


@router.patch("/recurrentes/{id_recurrente}/estado", response_model=RecurrenteOut)
def estado_recurrente(id_recurrente: int, form: EstadoForm, u: IdUsuario, con: Con):
    return recurrentes.cambiar_estado(con, u, id_recurrente, form.activa)


@router.delete("/recurrentes/{id_recurrente}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_recurrente(id_recurrente: int, u: IdUsuario, con: Con):
    recurrentes.eliminar(con, u, id_recurrente)


@router.post("/recurrentes/{id_recurrente}/confirmar", response_model=RespuestaConSaldo)
def confirmar_recurrente(id_recurrente: int, form: ConfirmacionRecurrenteForm, u: IdUsuario, con: Con):
    """Registra el movimiento del periodo y avanza a la siguiente fecha."""
    r = recurrentes.confirmar(con, u, id_recurrente, form)
    return con_saldo(con, u, f"{r['nombre']} registrado. Próxima fecha: {r['proxima_fecha']:%d/%m/%Y}.",
                     r["id_movimiento"], r["tipo"])


@router.post("/recurrentes/{id_recurrente}/omitir", response_model=RecurrenteOut)
def omitir_recurrente(id_recurrente: int, u: IdUsuario, con: Con):
    return recurrentes.omitir(con, u, id_recurrente)
