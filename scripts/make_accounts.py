"""Make username + password accounts (admin 6018: two static test logins). Each is a fresh new player (same start as a
guest: wallet, free items, intro not done) with no device id, so POST /v1/auth/guest can never resume it.

    python -m scripts.make_accounts tester1 tester2            (inside the runecast-api container)
    python -m scripts.make_accounts tester1 --reset-password   (new password for an existing account)

Prints each new password ONCE; only the bcrypt hash is stored (users.password_hash).
"""
import argparse
import asyncio
import re
import secrets

from sqlalchemy import select

from app.db import SessionLocal
from app.models import User
from app.passwords import hash_password
from app.routers.api import new_player

ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"   # no 0/O, 1/l/I: typed by hand on a phone


def new_password(n: int = 14) -> str:
    while True:
        pw = "".join(secrets.choice(ALPHABET) for _ in range(n))
        if re.search(r"[A-Z]", pw) and re.search(r"[a-z]", pw) and re.search(r"[2-9]", pw):
            return pw


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("usernames", nargs="+")
    ap.add_argument("--reset-password", action="store_true", help="give an existing account a new password")
    a = ap.parse_args()
    async with SessionLocal() as db:
        for raw in a.usernames:
            name = raw.strip().lower()
            if not re.fullmatch(r"[a-z0-9_.-]{3,32}", name):
                raise SystemExit(f"bad username: {raw}")
            user = (await db.execute(select(User).where(User.username == name))).scalar_one_or_none()
            if user is not None and not a.reset_password:
                print(f"{name}: exists ({user.id}), skipped (use --reset-password)")
                continue
            pw = new_password()
            if user is None:
                user = await new_player(db, device_id=None, kind="registered")
                user.username = name
            user.password_hash = hash_password(pw)
            await db.commit()
            print(f"{name}\t{pw}\t{user.id}")


if __name__ == "__main__":
    asyncio.run(main())
