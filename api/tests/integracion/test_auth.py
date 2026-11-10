import secrets

from sqlalchemy import text

from app.db import motor
from app.servicios import categorias
from tests.integracion.conftest import registro

REGISTRO = registro("Tortuga")


def test_flujo_completo_registro_yo_logout_login(cliente):
    r = cliente.post("/api/auth/registro", json=REGISTRO)
    assert r.status_code == 201
    assert r.json()["nombre_usuario"] == "tortuga"
    assert "contrasena_hash" not in r.json()

    cookie = r.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=lax" in cookie

    # El hash es argon2id y la BD no guarda el token en claro.
    with motor().connect() as c:
        hash_guardado = c.execute(text("SELECT contrasena_hash FROM usuario")).scalar_one()
        token_hash = c.execute(text("SELECT token_hash FROM sesion")).scalar_one()
    assert hash_guardado.startswith("$argon2id$")
    assert token_hash != cliente.cookies["hicotea_sesion"]

    assert cliente.get("/api/auth/yo").json()["nombre_completo"] == "Tortuga Prueba"
    assert cliente.post("/api/auth/logout").status_code == 204
    assert cliente.get("/api/auth/yo").status_code == 401

    r = cliente.post("/api/auth/login", json={"nombre_usuario": "TORTUGA", "contrasena": "caparazon123"})
    assert r.status_code == 200
    assert cliente.get("/api/auth/yo").status_code == 200


def test_el_registro_crea_las_categorias_por_defecto(cliente):
    cliente.post("/api/auth/registro", json=REGISTRO)
    nombres = {(c["tipo"], c["nombre"]) for c in cliente.get("/api/categorias").json()}
    esperadas = {(str(t), n) for t, lista in categorias.POR_DEFECTO.items() for n in lista}
    assert nombres == esperadas


def test_registro_exige_codigo_de_invitacion_y_confirmacion(cliente):
    r = cliente.post("/api/auth/registro", json={**REGISTRO, "codigo_invitacion": "otro"})
    assert r.status_code == 422 and "codigo_invitacion" in r.json()["errores"]
    r = cliente.post("/api/auth/registro", json={**REGISTRO, "confirmacion_contrasena": "distinta123"})
    assert r.status_code == 422 and "confirmacion_contrasena" in r.json()["errores"]
    with motor().connect() as c:
        assert c.execute(text("SELECT COUNT(*) FROM usuario")).scalar_one() == 0


def test_login_invalido_y_registro_duplicado(cliente):
    cliente.post("/api/auth/registro", json=REGISTRO)
    cliente.cookies.clear()

    malo = cliente.post("/api/auth/login", json={"nombre_usuario": "tortuga", "contrasena": "otra-cosa"})
    inexistente = cliente.post("/api/auth/login", json={"nombre_usuario": "nadie", "contrasena": "otra-cosa"})
    assert malo.status_code == inexistente.status_code == 401
    assert malo.json() == inexistente.json()
    assert cliente.get("/api/auth/yo").status_code == 401

    r = cliente.post("/api/auth/registro", json=REGISTRO)
    assert r.status_code == 409 and "nombre_usuario" in r.json()["errores"]


def test_el_limitador_bloquea_tras_cinco_fallos_aunque_la_clave_sea_correcta(cliente):
    cliente.post("/api/auth/registro", json=REGISTRO)
    cliente.cookies.clear()
    for _ in range(5):
        assert cliente.post("/api/auth/login", json={"nombre_usuario": "tortuga", "contrasena": "mala-mala"}).status_code == 401
    r = cliente.post("/api/auth/login", json={"nombre_usuario": "tortuga", "contrasena": "caparazon123"})
    assert r.status_code == 429


def test_origen_ajeno_rechazado(cliente):
    r = cliente.post("/api/auth/login", json={"nombre_usuario": "x", "contrasena": "y"},
                     headers={"Origin": "https://malicioso.example"})
    assert r.status_code == 403


def test_checks_de_movimiento_se_conservan():
    with motor().connect() as c:
        nombres = set(c.execute(text(
            "SELECT conname FROM pg_constraint WHERE conrelid = 'movimiento'::regclass AND contype = 'c'"
        )).scalars())
    assert {"ck_movimiento_tipo", "ck_movimiento_coherencia"} <= nombres


# ---------------------------------------------------------------- recuperación de contraseña


def _restablecer(cliente, pin, contrasena="nueva-clave-1"):
    return cliente.post("/api/auth/restablecer", json={
        "nombre_usuario": "tortuga", "pin": pin, "contrasena": contrasena, "confirmacion_contrasena": contrasena,
    })


def test_recuperacion_con_pin_cambia_la_clave_y_cierra_las_sesiones(cliente, monkeypatch):
    cliente.post("/api/auth/registro", json=REGISTRO)
    monkeypatch.setattr(secrets, "randbelow", lambda _: 123456)

    misma = cliente.post("/api/auth/recuperar", json={"nombre_usuario": "nadie"}).json()
    assert cliente.post("/api/auth/recuperar", json={"nombre_usuario": "tortuga"}).json() == misma

    assert _restablecer(cliente, "123456").status_code == 200
    assert cliente.get("/api/auth/yo").status_code == 401  # la sesión anterior se cerró
    assert cliente.post("/api/auth/login", json={"nombre_usuario": "tortuga", "contrasena": "caparazon123"}).status_code == 401
    assert cliente.post("/api/auth/login", json={"nombre_usuario": "tortuga", "contrasena": "nueva-clave-1"}).status_code == 200
    # El PIN no se puede reutilizar.
    assert _restablecer(cliente, "123456", "otra-clave-2").status_code == 422


def test_el_pin_admite_cinco_intentos_y_cada_fallo_queda_guardado(cliente, monkeypatch):
    cliente.post("/api/auth/registro", json=REGISTRO)
    monkeypatch.setattr(secrets, "randbelow", lambda _: 123456)
    cliente.post("/api/auth/recuperar", json={"nombre_usuario": "tortuga"})

    r = _restablecer(cliente, "000000")
    assert r.status_code == 422 and "4 intentos" in r.json()["detail"]
    # El intento quedó guardado aunque la petición respondió error (no hubo rollback).
    with motor().connect() as c:
        assert c.execute(text("SELECT intentos FROM recuperacion_contrasena WHERE NOT usada")).scalar_one() == 1
    for _ in range(3):
        _restablecer(cliente, "000000")
    assert "Agotaste" in _restablecer(cliente, "000000").json()["detail"]
    # Agotados los intentos, ni el PIN correcto sirve.
    assert _restablecer(cliente, "123456").status_code == 422


def test_no_se_genera_otro_pin_antes_de_sesenta_segundos(cliente, monkeypatch):
    cliente.post("/api/auth/registro", json=REGISTRO)
    pines = iter([111111, 222222])
    monkeypatch.setattr(secrets, "randbelow", lambda _: next(pines))
    cliente.post("/api/auth/recuperar", json={"nombre_usuario": "tortuga"})
    cliente.post("/api/auth/recuperar", json={"nombre_usuario": "tortuga"})  # ignorada
    with motor().connect() as c:
        assert c.execute(text("SELECT COUNT(*) FROM recuperacion_contrasena")).scalar_one() == 1
    assert _restablecer(cliente, "111111").status_code == 200
