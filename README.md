# Hicotea

Contexto completo en `CLAUDE.md`.

## Desarrollo

```sh
docker compose up -d db                 # PostgreSQL en localhost:5432

cd api
cp .env.example .env                    # define HICOTEA_CODIGO_INVITACION (obligatorio)
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload    # http://localhost:8000/api/docs
uv run pytest                           # unidad/ sin BD; integracion/ crea y borra hicotea_test

cd web
pnpm install
pnpm dev                                # http://localhost:5173 (proxy /api → :8000)
```

## Notas

- La documentación interactiva de la API está en `/api/docs`.
- Registrarse pide el código de invitación (`HICOTEA_CODIGO_INVITACION`).
- Recuperar contraseña: el PIN de 6 dígitos se imprime en la consola de uvicorn
  (no hay correo). Vence en 15 minutos y admite 5 intentos.
- Los montos se envían como texto en formato colombiano ("85.000", "$ 1.250.000,50")
  y la API los devuelve como string con dos decimales ("85000.00").
- Detrás de Caddy, uvicorn debe correr con `--proxy-headers` para que el límite
  de intentos de login vea la IP real.
