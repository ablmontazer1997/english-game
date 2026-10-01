from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

UTC = timezone.utc


def utcnow() -> datetime:
    return datetime.now(UTC)


def tz_of(name: str | None) -> ZoneInfo:
    try:
        return ZoneInfo(name or "UTC")
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo("UTC")


def valid_tz(name: str) -> bool:
    try:
        ZoneInfo(name)
        return True
    except (ZoneInfoNotFoundError, ValueError):
        return False


def local_day(tzname: str | None, now: datetime | None = None) -> date:
    return (now or utcnow()).astimezone(tz_of(tzname)).date()


def week_start(d: date) -> date:
    """weeks start on Monday (local)"""
    return d - timedelta(days=d.weekday())


def local_midnight_utc(tzname: str | None, d: date) -> datetime:
    return datetime.combine(d, time(0, 0), tzinfo=tz_of(tzname)).astimezone(UTC)


def end_of_local_day(tzname: str | None, now: datetime | None = None) -> datetime:
    return local_midnight_utc(tzname, local_day(tzname, now) + timedelta(days=1))


def ms(dt: datetime | None) -> int | None:
    return int(dt.timestamp() * 1000) if dt else None
