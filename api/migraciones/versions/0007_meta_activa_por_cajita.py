"""Caparazón: una meta activa por cajita y logro histórico de metas cumplidas

Revision ID: 0007
Revises: 0006

- `uq_meta_activa_por_cajita`: como máximo una meta **activa** por cajita
  (regla 2 del Caparazón). Las inactivas no cuentan: una cajita puede guardar
  el historial de varias metas cumplidas o abandonadas.
- `cumplida_en` y `monto_logrado`: al archivar una meta cumplida se guarda el
  logro, así no se borra si después se retira el dinero de la cajita (regla 3).

Es aditiva: no borra, archiva ni reasigna metas. Si ya existen cajitas con
varias metas activas, **se detiene sin cambiar nada** y lista los casos para
que el propietario decida cuál archivar. Ver docs/decisiones-caparazon-calendario.md.
"""

from alembic import op
from sqlalchemy import text

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None

CONFLICTOS = """
SELECT id_usuario, id_cajita, array_agg(id ORDER BY id) AS metas
FROM meta WHERE activa
GROUP BY id_usuario, id_cajita
HAVING count(*) > 1
ORDER BY id_usuario, id_cajita
"""

SQL = r"""
ALTER TABLE meta ADD COLUMN cumplida_en DATE;
ALTER TABLE meta ADD COLUMN monto_logrado NUMERIC(14,2) CHECK (monto_logrado IS NULL OR monto_logrado > 0);
ALTER TABLE meta ADD CONSTRAINT ck_meta_logro_completo
    CHECK ((cumplida_en IS NULL) = (monto_logrado IS NULL));
CREATE UNIQUE INDEX uq_meta_activa_por_cajita ON meta (id_cajita) WHERE activa;
"""


def upgrade() -> None:
    conflictos = op.get_bind().execute(text(CONFLICTOS)).all()
    if conflictos:
        detalle = "\n".join(f"  usuario {u}, cajita {c}: metas activas {list(ms)}" for u, c, ms in conflictos)
        raise RuntimeError(
            "No se puede crear uq_meta_activa_por_cajita: hay cajitas con varias metas activas.\n"
            f"{detalle}\n"
            "Archiva (activa = FALSE) todas menos una en cada cajita y vuelve a ejecutar la migración. "
            "La migración no cambia ninguna meta por su cuenta."
        )
    op.execute(SQL)


def downgrade() -> None:
    # Revierte la restricción. Las columnas de logro se pierden: respáldalas antes si ya hay datos.
    op.execute("DROP INDEX IF EXISTS uq_meta_activa_por_cajita")
    op.execute("ALTER TABLE meta DROP CONSTRAINT IF EXISTS ck_meta_logro_completo")
    op.execute("ALTER TABLE meta DROP COLUMN IF EXISTS monto_logrado")
    op.execute("ALTER TABLE meta DROP COLUMN IF EXISTS cumplida_en")
