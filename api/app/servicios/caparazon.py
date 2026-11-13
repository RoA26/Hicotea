"""Caparazón: la experiencia unificada del ahorro (cajitas + metas + reparto).

Compone los servicios existentes sin duplicar reglas: las validaciones de
cajitas y metas siguen viviendo en `servicios/cajitas.py` y `servicios/metas.py`.
"""

from sqlalchemy import Connection

from app.errores import ReglaNegocio
from app.esquemas.entradas import CajitaForm, MetaForm
from app.modelo import dinero
from app.servicios import cajitas, metas


def crear_cajita(con: Connection, id_usuario: int, form: CajitaForm) -> dict:
    """Crea la cajita y, si viene, su meta, **en la misma transacción** (una por
    petición, `app/db.py`): si la meta no es válida se lanza el error y no
    queda ninguna cajita creada a medias. Los errores de la meta llevan el
    prefijo `meta_` en el campo para que la web los muestre en su sección."""
    cajita = cajitas.crear(con, id_usuario, form)
    m = form.meta
    if m is None or (dinero.es_vacio_o_cero(m.monto_objetivo) and not (m.nombre or "").strip() and m.fecha_objetivo is None):
        return cajita
    try:
        metas.crear(
            con,
            id_usuario,
            MetaForm(
                nombre=(m.nombre or "").strip() or cajita["nombre"],
                monto_objetivo=m.monto_objetivo,
                fecha_objetivo=m.fecha_objetivo,
                id_cajita=cajita["id"],
            ),
        )
    except ReglaNegocio as e:
        campo = f"meta_{e.campo}" if e.campo else None
        raise ReglaNegocio(f"La meta no se pudo crear: {e.mensaje} No se creó la cajita.", campo, e.estado) from e
    return cajita
