import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app import correo
from app.config import config
from app.errores import registrar_manejadores
from app.rutas import admin, ahorro, auth, catalogos, compartir, cuenta, movimientos

# Logs propios de la app (p. ej. el PIN de recuperación) en la consola del servidor.
_log = logging.getLogger("hicotea")
if not _log.handlers:
    _manejador = logging.StreamHandler()
    _manejador.setFormatter(logging.Formatter("%(asctime)s %(levelname)s [%(name)s] %(message)s"))
    _log.addHandler(_manejador)
    _log.setLevel(logging.INFO)
    _log.propagate = False

config()  # falla al arrancar si la configuración es inválida
correo.revisar_al_arrancar()  # explica en el log (sin secretos) si el correo no podrá salir

app = FastAPI(title="Hicotea API", docs_url="/api/docs", openapi_url="/api/openapi.json")
registrar_manejadores(app)

_METODOS_SEGUROS = {"GET", "HEAD", "OPTIONS"}


@app.middleware("http")
async def verificar_origen(request: Request, call_next):
    """Defensa CSRF complementaria a SameSite=Lax: si el navegador envía Origin
    en una petición que cambia estado, debe ser uno de los permitidos."""
    if request.method not in _METODOS_SEGUROS:
        origen = request.headers.get("origin")
        if origen is not None and origen not in config().origenes_permitidos:
            return JSONResponse({"detail": "Origen no permitido", "errores": {}}, status_code=403)
    return await call_next(request)


for modulo in (auth, cuenta, catalogos, movimientos, ahorro, compartir, admin):
    app.include_router(modulo.router)


@app.get("/api/salud")
def salud():
    return {"ok": True}
