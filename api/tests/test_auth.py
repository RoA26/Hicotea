from sqlalchemy import text

from app.db import motor

REGISTRO = {"nombre_usuario": "Tortuga", "nombre_completo": "Hicotea Prueba", "contrasena": "caparazon123"}


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

    assert cliente.get("/api/auth/yo").json()["nombre_completo"] == "Hicotea Prueba"

    assert cliente.post("/api/auth/logout").status_code == 204
    assert cliente.get("/api/auth/yo").status_code == 401

    r = cliente.post("/api/auth/login", json={"nombre_usuario": "TORTUGA", "contrasena": "caparazon123"})
    assert r.status_code == 200
    assert cliente.get("/api/auth/yo").status_code == 200


def test_login_invalido_y_registro_duplicado(cliente):
    cliente.post("/api/auth/registro", json=REGISTRO)
    cliente.cookies.clear()

    malo = cliente.post("/api/auth/login", json={"nombre_usuario": "tortuga", "contrasena": "otra-cosa"})
    inexistente = cliente.post("/api/auth/login", json={"nombre_usuario": "nadie", "contrasena": "otra-cosa"})
    assert malo.status_code == inexistente.status_code == 401
    assert malo.json() == inexistente.json()
    assert cliente.get("/api/auth/yo").status_code == 401

    assert cliente.post("/api/auth/registro", json=REGISTRO).status_code == 409


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
