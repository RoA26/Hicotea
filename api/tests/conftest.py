"""Los tests usan un PostgreSQL real: crean la base HICOTEA_TEST_DATABASE_URL,
aplican todas las migraciones (así también se prueban) y la borran al final."""

import os

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

URL_TEST = os.environ.get(
    "HICOTEA_TEST_DATABASE_URL",
    "postgresql+psycopg://hicotea:hicotea@localhost:5432/hicotea_test",
)
os.environ["HICOTEA_DATABASE_URL"] = URL_TEST  # antes de importar la app

from alembic import command  # noqa: E402
from alembic.config import Config as AlembicConfig  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import motor  # noqa: E402
from app.main import app  # noqa: E402

RAIZ_API = os.path.dirname(os.path.dirname(__file__))


def _admin_url():
    return make_url(URL_TEST).set(database="postgres")


@pytest.fixture(scope="session", autouse=True)
def base_de_datos():
    nombre = make_url(URL_TEST).database
    admin = create_engine(_admin_url(), isolation_level="AUTOCOMMIT")
    with admin.connect() as c:
        c.execute(text(f'DROP DATABASE IF EXISTS "{nombre}" WITH (FORCE)'))
        c.execute(text(f'CREATE DATABASE "{nombre}"'))

    cfg = AlembicConfig(os.path.join(RAIZ_API, "alembic.ini"))
    cfg.set_main_option("sqlalchemy.url", URL_TEST)
    command.upgrade(cfg, "head")
    yield
    motor().dispose()
    with admin.connect() as c:
        c.execute(text(f'DROP DATABASE IF EXISTS "{nombre}" WITH (FORCE)'))
    admin.dispose()


@pytest.fixture(autouse=True)
def limpiar():
    yield
    with motor().begin() as c:
        c.execute(text("TRUNCATE usuario RESTART IDENTITY CASCADE"))


@pytest.fixture
def cliente():
    with TestClient(app) as c:
        yield c
