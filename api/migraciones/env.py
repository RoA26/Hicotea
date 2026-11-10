from alembic import context
from sqlalchemy import create_engine, pool

from app.config import config as config_app

# Sin metadata: las migraciones son SQL explícito (op.execute), no autogenerate.
url = context.config.get_main_option("sqlalchemy.url") or config_app().database_url


def run_migrations_offline() -> None:
    context.configure(url=url, literal_binds=True, dialect_opts={"paramstyle": "named"})
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    motor = create_engine(url, poolclass=pool.NullPool)
    with motor.connect() as con:
        context.configure(connection=con, transaction_per_migration=True)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
