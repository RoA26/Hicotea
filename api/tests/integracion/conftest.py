"""Los tests de integración usan un PostgreSQL real: crean la base
HICOTEA_TEST_DATABASE_URL, aplican todas las migraciones (así también se
prueban) y la borran al final."""

import os
from datetime import date

import pytest
from alembic import command
from alembic.config import Config as AlembicConfig
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from app.db import motor
from app.main import app
from app.modelo import reloj
from app.seguridad.limitador import limitador

URL_TEST = os.environ["HICOTEA_TEST_DATABASE_URL"]
RAIZ_API = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
CODIGO = os.environ["HICOTEA_CODIGO_INVITACION"]
HOY = date(2026, 11, 10)


@pytest.fixture(scope="session", autouse=True)
def base_de_datos():
    nombre = make_url(URL_TEST).database
    admin = create_engine(make_url(URL_TEST).set(database="postgres"), isolation_level="AUTOCOMMIT")
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
    limitador.reiniciar()
    yield
    with motor().begin() as c:
        c.execute(text("TRUNCATE usuario RESTART IDENTITY CASCADE"))


@pytest.fixture(autouse=True)
def hoy(monkeypatch):
    """Fija "hoy" para que las reglas de fechas sean deterministas. Devuelve
    una función para moverlo dentro del test."""
    actual = {"fecha": HOY}
    monkeypatch.setattr(reloj, "hoy", lambda: actual["fecha"])

    def mover(fecha: date):
        actual["fecha"] = fecha

    mover.fecha = lambda: actual["fecha"]
    return mover


@pytest.fixture
def cliente():
    with TestClient(app) as c:
        yield c


class Usuario:
    """Un TestClient con sesión iniciada y atajos para los datos de prueba."""

    def __init__(self, nombre: str):
        self.nombre = nombre
        self.c = TestClient(app)
        r = self.c.post("/api/auth/registro", json=registro(nombre))
        assert r.status_code == 201, r.text
        self.id = r.json()["id"]
        self._categorias = {c["nombre"]: c["id"] for c in self.c.get("/api/categorias").json()}

    def cat(self, nombre: str) -> int:
        return self._categorias[nombre]

    def get(self, *a, **k):
        return self.c.get(*a, **k)

    def post(self, *a, **k):
        return self.c.post(*a, **k)

    def put(self, *a, **k):
        return self.c.put(*a, **k)

    def patch(self, *a, **k):
        return self.c.patch(*a, **k)

    def delete(self, *a, **k):
        return self.c.delete(*a, **k)

    # -------- datos frecuentes
    def fuente(self, nombre="Motocarro", frecuencia="DIARIA") -> int:
        r = self.post("/api/fuentes", json={"nombre": nombre, "frecuencia": frecuencia})
        assert r.status_code == 201, r.text
        return r.json()["id"]

    def ingreso(self, monto="100000", fecha=HOY, categoria="Salario", **extra) -> int:
        r = self.post("/api/movimientos", json={"tipo": "INGRESO", "fecha": str(fecha), "monto": monto,
                                                 "id_categoria": self.cat(categoria), **extra})
        assert r.status_code == 201, r.text
        return r.json()["id_movimiento"]

    def cajita(self, nombre="Ahorro", porcentaje="0", es_resto=False, saldo_inicial=None, proposito="LIBRE") -> dict:
        r = self.post("/api/cajitas", json={"nombre": nombre, "proposito": proposito, "porcentaje": porcentaje,
                                             "es_resto": es_resto, "saldo_inicial": saldo_inicial})
        assert r.status_code == 201, r.text
        return r.json()

    def saldo(self) -> dict:
        return self.get("/api/saldo").json()


def registro(nombre: str, **extra) -> dict:
    return {
        "nombre_usuario": nombre,
        "nombre_completo": f"{nombre.title()} Prueba",
        "contrasena": "caparazon123",
        "confirmacion_contrasena": "caparazon123",
        "codigo_invitacion": CODIGO,
        **extra,
    }


@pytest.fixture
def ana():
    u = Usuario("ana")
    yield u
    u.c.close()


@pytest.fixture
def beto():
    u = Usuario("beto")
    yield u
    u.c.close()
