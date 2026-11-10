"""Errores de negocio y su traducción a JSON.

Todas las respuestas de error tienen la forma:
    {"detail": "mensaje para mostrar", "errores": {"campo": "mensaje"}}
"""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class ReglaNegocio(Exception):
    """Una regla de negocio no se cumple. `campo` indica qué dato del formulario corregir."""

    def __init__(self, mensaje: str, campo: str | None = None, estado: int = 422):
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.campo = campo
        self.estado = estado


class NoEncontrado(Exception):
    def __init__(self, mensaje: str = "No encontrado"):
        super().__init__(mensaje)
        self.mensaje = mensaje


def registrar_manejadores(app: FastAPI) -> None:
    @app.exception_handler(ReglaNegocio)
    async def _regla(_: Request, e: ReglaNegocio):
        errores = {e.campo: e.mensaje} if e.campo else {}
        return JSONResponse({"detail": e.mensaje, "errores": errores}, status_code=e.estado)

    @app.exception_handler(NoEncontrado)
    async def _no_encontrado(_: Request, e: NoEncontrado):
        return JSONResponse({"detail": e.mensaje, "errores": {}}, status_code=404)

    @app.exception_handler(RequestValidationError)
    async def _validacion(_: Request, e: RequestValidationError):
        errores: dict[str, str] = {}
        for err in e.errors():
            campo = str(err["loc"][-1]) if err.get("loc") else "general"
            errores.setdefault(campo, err.get("msg", "Valor inválido"))
        return JSONResponse(
            {"detail": "Revisa los datos del formulario.", "errores": errores}, status_code=422
        )
