"""Caparazón: descripción de cajita y fecha en que se alcanzó una meta

Revision ID: 0008
Revises: 0007

- `cajita.descripcion` (opcional): para qué es la cajita, en palabras del usuario.
- `meta.alcanzada_en` (opcional): primera fecha en que el saldo de la cajita
  llegó al objetivo, **calculada al reconocer el logro** a partir del historial
  de movimientos (no se modifica ningún movimiento). Es distinta de
  `cumplida_en`, que desde ahora significa **fecha de reconocimiento** (el día
  en que el usuario celebró y guardó el logro).

Aditiva y reversible; no toca datos existentes.
"""

from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE cajita ADD COLUMN descripcion VARCHAR(200)")
    op.execute("ALTER TABLE meta ADD COLUMN alcanzada_en DATE")
    op.execute("COMMENT ON COLUMN meta.cumplida_en IS 'Fecha en que el usuario reconoció el logro'")
    op.execute("COMMENT ON COLUMN meta.alcanzada_en IS 'Primera fecha en que el saldo de la cajita llegó al objetivo (calculada al reconocer)'")


def downgrade() -> None:
    op.execute("ALTER TABLE meta DROP COLUMN IF EXISTS alcanzada_en")
    op.execute("ALTER TABLE cajita DROP COLUMN IF EXISTS descripcion")
