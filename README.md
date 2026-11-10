# Hicotea

Contexto completo en `CLAUDE.md`.

## Desarrollo

```sh
docker compose up -d db                 # PostgreSQL en localhost:5432

cd api
cp .env.example .env
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload    # http://localhost:8000/api/docs
uv run pytest                           # crea y borra la base hicotea_test

cd web
pnpm install
pnpm dev                                # http://localhost:5173 (proxy /api → :8000)
```
