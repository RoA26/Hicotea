from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.config import config
from app.rutas import auth

app = FastAPI(title="Hicotea API", docs_url="/api/docs", openapi_url="/api/openapi.json")

_METODOS_SEGUROS = {"GET", "HEAD", "OPTIONS"}


@app.middleware("http")
async def verificar_origen(request: Request, call_next):
    """Defensa CSRF complementaria a SameSite=Lax: si el navegador envía Origin
    en una petición que cambia estado, debe ser uno de los permitidos."""
    if request.method not in _METODOS_SEGUROS:
        origen = request.headers.get("origin")
        if origen is not None and origen not in config().origenes_permitidos:
            return JSONResponse({"detail": "Origen no permitido"}, status_code=403)
    return await call_next(request)


app.include_router(auth.router)


@app.get("/api/salud")
def salud():
    return {"ok": True}
