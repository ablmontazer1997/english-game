"""Make a single-use sign-in code for one account (admin 5935, Android app). Prints the code and the links.

    python -m scripts.mint_login <user uuid> [--days 7] [--note "admin phone"]     (inside the runecast-api container)

The app trades it once at POST /v1/auth/redeem (via https://bingual.app/runecast/?login=<code> or
englishspell://login?code=<code>). Only the SHA-256 is stored; a used or expired code is refused.
"""
import argparse
import asyncio
import hashlib
import secrets
import uuid
from datetime import timedelta

from app.db import SessionLocal
from app.models import LoginCode, User
from app.timeutil import utcnow


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("user_id")
    ap.add_argument("--days", type=float, default=7)
    ap.add_argument("--note", default="")
    a = ap.parse_args()
    async with SessionLocal() as db:
        user = await db.get(User, uuid.UUID(a.user_id))
        if user is None:
            raise SystemExit("no such user")
        code = secrets.token_urlsafe(24)
        exp = utcnow() + timedelta(days=a.days)
        db.add(LoginCode(code_hash=hashlib.sha256(code.encode()).hexdigest(), user_id=user.id, note=a.note,
                         expires_at=exp))
        await db.commit()
        print(f"user {user.id} ({user.display_name}) code expires {exp:%Y-%m-%d %H:%M} UTC")
        print("code:", code)
        print("app link:", f"https://bingual.app/runecast/app-login.html?code={code}")
        print("deep link:", f"englishspell://login?code={code}")
        print("web link:", f"https://bingual.app/runecast/?login={code}")


if __name__ == "__main__":
    asyncio.run(main())
