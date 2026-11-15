"""Administración de plataforma: autorización, invitaciones, bloqueo,
sesiones, auditoría y privacidad de los datos financieros."""

import threading
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app import cli
from app.config import config
from app.db import motor
from app.esquemas.auth import RegistroForm
from app.main import app
from app.servicios import auth as servicio_auth
from tests.integracion.conftest import Usuario, registro

# Todas las rutas del panel, con un cuerpo válido para las que lo necesitan.
RUTAS_ADMIN = [
    ("get", "/api/admin/resumen", None),
    ("get", "/api/admin/usuarios", None),
    ("post", "/api/admin/usuarios/1/bloquear", None),
    ("post", "/api/admin/usuarios/1/desbloquear", None),
    ("post", "/api/admin/usuarios/1/cerrar-sesiones", None),
    ("get", "/api/admin/invitaciones", None),
    ("post", "/api/admin/invitaciones", {"dias": 7}),
    ("post", "/api/admin/invitaciones/1/revocar", None),
    ("get", "/api/admin/auditoria", None),
]


def _hacer_admin(nombre: str) -> None:
    assert cli.main(["admin", "otorgar", nombre]) == 0


@pytest.fixture
def admin():
    u = Usuario("admin")
    _hacer_admin("admin")
    yield u
    u.c.close()


def _token(enlace: str) -> str:
    return parse_qs(urlparse(enlace).query)["invitacion"][0]


def _invitar(admin, **datos) -> dict:
    r = admin.post("/api/admin/invitaciones", json={"dias": 7, **datos})
    assert r.status_code == 201, r.text
    return r.json()


def _sql(consulta: str, **params):
    with motor().begin() as c:
        return c.execute(text(consulta), params)


# ---------------------------------------------------------------- autorización


def test_un_usuario_normal_no_puede_usar_ninguna_ruta_administrativa(ana):
    for metodo, ruta, cuerpo in RUTAS_ADMIN:
        r = getattr(ana.c, metodo)(ruta, **({"json": cuerpo} if cuerpo else {}))
        assert r.status_code == 403, f"{metodo.upper()} {ruta} → {r.status_code}"
    # Y nada quedó hecho: ninguna invitación ni evento de auditoría.
    assert _sql("SELECT COUNT(*) FROM invitacion").scalar_one() == 0
    assert _sql("SELECT COUNT(*) FROM auditoria_admin").scalar_one() == 0


def test_sin_sesion_las_rutas_administrativas_responden_401(cliente):
    for metodo, ruta, cuerpo in RUTAS_ADMIN:
        r = getattr(cliente, metodo)(ruta, **({"json": cuerpo} if cuerpo else {}))
        assert r.status_code == 401, f"{metodo.upper()} {ruta} → {r.status_code}"


def test_el_rol_se_lee_del_servidor_en_cada_peticion(ana):
    assert ana.get("/api/auth/yo").json()["rol"] == "USUARIO"
    _hacer_admin("ana")
    assert ana.get("/api/admin/resumen").status_code == 200  # sin volver a iniciar sesión
    # Quitarle el rol al único administrador no se permite.
    assert cli.main(["admin", "revocar", "ana"]) == 1
    Usuario("carla")
    _hacer_admin("carla")
    assert cli.main(["admin", "revocar", "ana"]) == 0
    assert ana.get("/api/admin/resumen").status_code == 403


def test_nadie_es_administrador_por_defecto(ana, beto):
    assert _sql("SELECT COUNT(*) FROM usuario WHERE rol = 'ADMIN'").scalar_one() == 0


# ---------------------------------------------------------------- invitaciones


def test_invitacion_de_un_solo_uso_y_el_token_no_se_guarda_en_claro(admin, cliente):
    inv = _invitar(admin, nota="Para Dani")
    token = _token(inv["enlace"])
    assert inv["estado"] == "PENDIENTE"
    guardado = _sql("SELECT token_hash FROM invitacion WHERE id = :id", id=inv["id"]).scalar_one()
    assert token not in guardado and len(guardado) == 64
    # El listado nunca devuelve el enlace ni el token.
    listado = admin.get("/api/admin/invitaciones").text
    assert token not in listado and "enlace" not in listado

    assert cliente.post("/api/auth/invitacion", json={"token": token}).json() == {"valida": True, "correo": None}
    r = cliente.post("/api/auth/registro", json=registro("dani", codigo_invitacion=token))
    assert r.status_code == 201, r.text
    estado = admin.get("/api/admin/invitaciones").json()["elementos"][0]
    assert (estado["estado"], estado["usada_por"]) == ("USADA", "dani")

    otro = TestClient(app)
    r = otro.post("/api/auth/registro", json=registro("eva", codigo_invitacion=token))
    assert r.status_code == 422 and "codigo_invitacion" in r.json()["errores"]
    assert otro.post("/api/auth/invitacion", json={"token": token}).json()["valida"] is False


def test_invitacion_revocada_o_vencida_no_sirve(admin, cliente):
    revocada = _invitar(admin)
    assert admin.post(f"/api/admin/invitaciones/{revocada['id']}/revocar").json()["estado"] == "REVOCADA"
    # Revocar dos veces se rechaza (solo pendientes) y queda auditado.
    assert admin.post(f"/api/admin/invitaciones/{revocada['id']}/revocar").status_code == 409
    r = cliente.post("/api/auth/registro", json=registro("dani", codigo_invitacion=_token(revocada["enlace"])))
    assert r.status_code == 422

    vencida = _invitar(admin)
    _sql("UPDATE invitacion SET creada_en = now() - interval '9 days', expira_en = now() - interval '1 day' WHERE id = :id",
         id=vencida["id"])
    r = cliente.post("/api/auth/registro", json=registro("dani", codigo_invitacion=_token(vencida["enlace"])))
    assert r.status_code == 422
    conteo = admin.get("/api/admin/resumen").json()["invitaciones"]
    assert (conteo["REVOCADA"], conteo["EXPIRADA"]) == (1, 1)


def test_si_el_registro_falla_la_invitacion_sigue_pendiente(admin, cliente):
    token = _token(_invitar(admin)["enlace"])
    # "admin" ya existe: el registro falla después de validar la invitación.
    r = cliente.post("/api/auth/registro", json=registro("admin", codigo_invitacion=token))
    assert r.status_code == 409
    assert admin.get("/api/admin/invitaciones").json()["elementos"][0]["estado"] == "PENDIENTE"
    assert cliente.post("/api/auth/registro", json=registro("dani", codigo_invitacion=token)).status_code == 201


def test_invitacion_asociada_a_un_correo(admin, cliente):
    inv = _invitar(admin, correo="Dani@Ejemplo.co")
    token = _token(inv["enlace"])
    assert cliente.post("/api/auth/invitacion", json={"token": token}).json()["correo"] == "dani@ejemplo.co"
    r = cliente.post("/api/auth/registro", json=registro("dani", codigo_invitacion=token, correo="otra@ejemplo.co"))
    assert r.status_code == 422 and "correo" in r.json()["errores"]
    r = cliente.post("/api/auth/registro", json=registro("dani", codigo_invitacion=token, correo="dani@ejemplo.co"))
    assert r.status_code == 201 and r.json()["correo"] == "dani@ejemplo.co"


def test_dos_registros_simultaneos_con_la_misma_invitacion_solo_uno_gana(admin):
    token = _token(_invitar(admin)["enlace"])
    con_a = motor().connect()
    servicio_auth.registrar(con_a, RegistroForm(**registro("primero", codigo_invitacion=token)))  # sin confirmar
    resultado: dict = {}

    def segundo():
        with motor().connect() as con_b:
            try:
                servicio_auth.registrar(con_b, RegistroForm(**registro("segundo", codigo_invitacion=token)))
                con_b.commit()
                resultado["ok"] = True
            except Exception as e:  # noqa: BLE001
                con_b.rollback()
                resultado["error"] = e

    hilo = threading.Thread(target=segundo, daemon=True)
    hilo.start()
    hilo.join(0.6)
    assert hilo.is_alive(), "el segundo registro no esperó al primero"
    con_a.commit()
    con_a.close()
    hilo.join(10)
    assert "ok" not in resultado and "invitación" in str(resultado["error"]).lower()
    nombres = set(_sql("SELECT nombre_usuario FROM usuario").scalars())
    assert "primero" in nombres and "segundo" not in nombres


def test_el_codigo_global_heredado_se_puede_apagar(cliente, monkeypatch):
    monkeypatch.setattr(config(), "codigo_invitacion", None)
    r = cliente.post("/api/auth/registro", json=registro("dani"))
    assert r.status_code == 422 and "codigo_invitacion" in r.json()["errores"]


def test_muchas_invitaciones_falsas_desde_una_ip_se_frenan(cliente):
    for _ in range(10):
        cliente.post("/api/auth/registro", json=registro("dani", codigo_invitacion="no-existe"))
    r = cliente.post("/api/auth/registro", json=registro("dani"))
    assert r.status_code == 429


# ---------------------------------------------------------------- bloqueo y sesiones


def test_bloquear_corta_las_sesiones_y_el_acceso(admin, ana):
    assert ana.get("/api/tablero").status_code == 200
    r = admin.post(f"/api/admin/usuarios/{ana.id}/bloquear")
    assert r.status_code == 200 and r.json()["activo"] is False and r.json()["sesiones_activas"] == 0
    assert ana.get("/api/tablero").status_code == 401  # la sesión abierta ya no sirve

    c = TestClient(app)
    bien = c.post("/api/auth/login", json={"nombre_usuario": "ana", "contrasena": "caparazon123"})
    mal = c.post("/api/auth/login", json={"nombre_usuario": "ana", "contrasena": "otra-cosa"})
    assert bien.status_code == 403 and "bloqueada" in bien.json()["detail"]
    assert mal.status_code == 401  # sin la contraseña no se revela que está bloqueada
    # Tampoco puede recuperar la contraseña.
    c.post("/api/auth/recuperar", json={"nombre_usuario": "ana"})
    assert _sql("SELECT COUNT(*) FROM recuperacion_contrasena").scalar_one() == 0

    assert admin.post(f"/api/admin/usuarios/{ana.id}/desbloquear").json()["activo"] is True
    assert c.post("/api/auth/login", json={"nombre_usuario": "ana", "contrasena": "caparazon123"}).status_code == 200


def test_un_admin_no_puede_bloquearse_ni_dejar_la_plataforma_sin_admin(admin, ana):
    r = admin.post(f"/api/admin/usuarios/{admin.id}/bloquear")
    assert r.status_code == 409
    assert admin.get("/api/auth/yo").status_code == 200
    evento = admin.get("/api/admin/auditoria").json()["elementos"][0]
    assert (evento["accion"], evento["resultado"]) == ("BLOQUEAR_CUENTA", "RECHAZADO")

    # Con dos administradores, uno puede bloquear al otro; el que queda sigue activo.
    _hacer_admin("ana")
    assert admin.post(f"/api/admin/usuarios/{ana.id}/bloquear").status_code == 200
    assert admin.get("/api/admin/resumen").json()["cuentas"]["administradores"] == 1


def test_cerrar_sesiones_de_otra_cuenta(admin, ana):
    otra = TestClient(app)
    otra.post("/api/auth/login", json={"nombre_usuario": "ana", "contrasena": "caparazon123"})
    cuenta = next(c for c in admin.get("/api/admin/usuarios").json()["elementos"] if c["id"] == ana.id)
    assert cuenta["sesiones_activas"] == 2
    r = admin.post(f"/api/admin/usuarios/{ana.id}/cerrar-sesiones")
    assert r.json()["sesiones_activas"] == 0
    assert ana.get("/api/auth/yo").status_code == 401 and otra.get("/api/auth/yo").status_code == 401
    # La cuenta sigue activa: puede volver a entrar.
    assert otra.post("/api/auth/login", json={"nombre_usuario": "ana", "contrasena": "caparazon123"}).status_code == 200


# ---------------------------------------------------------------- listado, privacidad y auditoría


def test_listado_busqueda_y_filtros_sin_datos_financieros(admin, ana, beto):
    ana.ingreso("4.321.987")
    r = admin.get("/api/admin/usuarios", params={"q": "an"}).json()
    assert [c["nombre_usuario"] for c in r["elementos"]] == ["ana"]
    assert set(r["elementos"][0]) == {
        "id", "nombre_usuario", "nombre_completo", "correo", "correo_verificado", "rol", "activo", "bloqueado_en",
        "fecha_registro", "ultimo_ingreso_en", "sesiones_activas",
    }
    # Los comodines se tratan como texto.
    assert admin.get("/api/admin/usuarios", params={"q": "%"}).json()["total"] == 0
    assert admin.get("/api/admin/usuarios", params={"rol": "ADMIN"}).json()["total"] == 1
    admin.post(f"/api/admin/usuarios/{beto.id}/bloquear")
    bloqueadas = admin.get("/api/admin/usuarios", params={"estado": "BLOQUEADA"}).json()["elementos"]
    assert [c["nombre_usuario"] for c in bloqueadas] == ["beto"]

    # Ninguna respuesta del panel contiene montos ni datos financieros de nadie.
    for _, ruta, _ in [x for x in RUTAS_ADMIN if x[0] == "get"]:
        cuerpo = admin.get(ruta).text
        for prohibido in ("4321987", "saldo", "monto", "movimiento", "contrasena", "token", "pin"):
            assert prohibido not in cuerpo.lower(), f"{ruta} expone '{prohibido}'"


def test_la_auditoria_registra_autor_accion_recurso_y_resultado(admin, ana):
    inv = _invitar(admin, nota="Para Fer")
    admin.post(f"/api/admin/invitaciones/{inv['id']}/revocar")
    admin.post(f"/api/admin/usuarios/{ana.id}/bloquear")
    eventos = admin.get("/api/admin/auditoria").json()["elementos"]
    resumen = [(e["admin_nombre"], e["accion"], e["recurso_tipo"], e["resultado"]) for e in eventos]
    assert resumen[:3] == [
        ("admin", "BLOQUEAR_CUENTA", "USUARIO", "EXITO"),
        ("admin", "REVOCAR_INVITACION", "INVITACION", "EXITO"),
        ("admin", "CREAR_INVITACION", "INVITACION", "EXITO"),
    ]
    assert resumen[3][0].startswith("cli") and resumen[3][1] == "OTORGAR_ADMIN"
    assert _token(inv["enlace"]) not in str(eventos)
