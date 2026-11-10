from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

_hasher = PasswordHasher()  # argon2id con los parámetros por defecto de argon2-cffi

# Hash de relleno para que un login con usuario inexistente tarde lo mismo.
_HASH_FALSO = _hasher.hash("hicotea-relleno")


def hashear(contrasena: str) -> str:
    return _hasher.hash(contrasena)


def verificar(hash_guardado: str | None, contrasena: str) -> bool:
    try:
        return _hasher.verify(hash_guardado or _HASH_FALSO, contrasena) and hash_guardado is not None
    except (VerificationError, InvalidHashError):
        return False


def necesita_rehash(hash_guardado: str) -> bool:
    return _hasher.check_needs_rehash(hash_guardado)
