from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .config import get_settings
from .db import engine
from .routers.api import router

s = get_settings()

DESCRIPTION = """Backend for **English Spell**, an English-to-English grammar adventure (levels A1-C1).

Server-authoritative: stars, XP, coins, gems, items, hearts, SRS, streak, quests and league points are all
computed on the server. Get a token from `POST /v1/auth/guest`, then send `Authorization: Bearer <token>`.
The full contract with rules is in API.md."""

app = FastAPI(title=f"{s.app_name} API", version=s.version, description=DESCRIPTION, root_path=s.root_path,
              openapi_tags=[{"name": n} for n in ["auth", "map", "play", "review", "wallet", "shop", "inventory",
                                                     "engagement", "payments", "health"]])
app.add_middleware(CORSMiddleware, allow_origins=[o.strip() for o in s.cors_origins.split(",") if o.strip()],
                   allow_methods=["*"], allow_headers=["*"])
app.include_router(router)


@app.get("/health", tags=["health"])
async def health():
    ok = True
    try:
        async with engine.connect() as c:
            await c.execute(text("select 1"))
    except Exception:
        ok = False
    return {"ok": ok, "db": ok, "app": s.app_name, "version": s.version}
