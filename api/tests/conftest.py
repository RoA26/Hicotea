"""Configuración común. Se fija antes de importar la app."""

import os

os.environ.setdefault("HICOTEA_CODIGO_INVITACION", "codigo-de-prueba")
os.environ.setdefault(
    "HICOTEA_TEST_DATABASE_URL", "postgresql+psycopg://hicotea:hicotea@localhost:5432/hicotea_test"
)
os.environ["HICOTEA_DATABASE_URL"] = os.environ["HICOTEA_TEST_DATABASE_URL"]
