"""recuperacion contrasena (portado literal de Eden V4__recuperacion_contrasena.sql)

Revision ID: 0004
Revises: 0003
"""

from alembic import op

revision = "0004"
down_revision = '0003'
branch_labels = None
depends_on = None

SQL = r"""
-- =====================================================================
-- V4: recuperacion de contrasena con PIN temporal.
-- El PIN se muestra en la consola del servidor (no hay correo todavia) y
-- aqui solo se guarda su hash BCrypt, con vencimiento e intentos limitados.
-- =====================================================================

CREATE TABLE recuperacion_contrasena (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_usuario       BIGINT       NOT NULL REFERENCES usuario (id) ON DELETE CASCADE,
    pin_hash         VARCHAR(100) NOT NULL,
    fecha_creacion   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    expira_en        TIMESTAMPTZ  NOT NULL,
    intentos         SMALLINT     NOT NULL DEFAULT 0 CHECK (intentos >= 0),
    usada            BOOLEAN      NOT NULL DEFAULT FALSE
);

CREATE INDEX ix_recuperacion_pendiente ON recuperacion_contrasena (id_usuario, fecha_creacion DESC) WHERE NOT usada;
"""


def upgrade() -> None:
    op.execute(SQL)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS recuperacion_contrasena")
