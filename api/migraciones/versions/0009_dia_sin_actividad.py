"""Calendario vivo: días confirmados sin actividad (C-04)

Revision ID: 0009
Revises: 0008

Tabla propia, sin relación con `movimiento`: confirmar que un día no tuvo
actividad **no** crea movimientos de cero pesos ni cambia saldos. Clave
(usuario, fecha): una confirmación por día, idempotente. Si después se
registra un movimiento ese día, el movimiento manda (lo resuelve el
calendario); la fila se conserva por si ese movimiento se elimina.
"""

from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE dia_sin_actividad (
            id_usuario     BIGINT      NOT NULL REFERENCES usuario (id) ON DELETE CASCADE,
            fecha          DATE        NOT NULL,
            confirmado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (id_usuario, fecha)
        )
        """
    )


def downgrade() -> None:
    # Es una preferencia de presentación: borrarla no afecta ningún saldo.
    op.execute("DROP TABLE IF EXISTS dia_sin_actividad")
