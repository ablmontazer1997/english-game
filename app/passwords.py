"""Password hashing for username accounts (admin 6018). bcrypt, cost 12; only the hash is stored.
bcrypt is CPU-bound (~0.2 s), so the async API runs it in a worker thread."""
import asyncio

import bcrypt

ROUNDS = 12
# compared when the username does not exist, so a miss takes as long as a wrong password
_DUMMY = bcrypt.hashpw(b"no-such-account", bcrypt.gensalt(ROUNDS))


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode()[:72], bcrypt.gensalt(ROUNDS)).decode()


async def verify_password(pw: str, hashed: str | None) -> bool:
    h = hashed.encode() if hashed else _DUMMY
    try:
        ok = await asyncio.to_thread(bcrypt.checkpw, pw.encode()[:72], h)
    except ValueError:
        return False
    return ok and hashed is not None
