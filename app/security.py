import uuid
from datetime import timedelta

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from .config import get_settings
from .db import get_db
from .errors import ApiError
from .models import User
from .timeutil import utcnow

bearer = HTTPBearer(auto_error=False)


def make_token(user_id: uuid.UUID):
    s = get_settings()
    exp = utcnow() + timedelta(days=s.jwt_days)
    tok = jwt.encode({"sub": str(user_id), "exp": exp, "iat": utcnow(), "typ": "access"}, s.jwt_secret,
                     algorithm="HS256")
    return tok, exp


async def current_user(cred: HTTPAuthorizationCredentials | None = Depends(bearer),
                       db: AsyncSession = Depends(get_db)) -> User:
    if cred is None:
        raise ApiError(401, "unauthorized", "missing bearer token")
    try:
        data = jwt.decode(cred.credentials, get_settings().jwt_secret, algorithms=["HS256"])
        uid = uuid.UUID(data["sub"])
    except Exception:
        raise ApiError(401, "unauthorized", "invalid or expired token")
    user = await db.get(User, uid)
    if user is None:
        raise ApiError(401, "unauthorized", "unknown user")
    return user
