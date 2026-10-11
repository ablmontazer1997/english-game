from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="RUNECAST_", env_file=".env", extra="ignore")

    app_name: str = "English Spell"
    version: str = "1.0.0"
    db_host: str = "bingual-backend-db-1"
    db_port: int = 5432
    db_name: str = "runecast"
    db_user: str = "runecast"
    db_password: str = ""
    db_pool_size: int = 3
    db_max_overflow: int = 2
    jwt_secret: str = "dev-secret-change-me"
    jwt_days: int = 90
    root_path: str = ""  # "/runecast-api" behind Caddy
    qdb_dir: str = "/qdb"
    # anti-cheat: a stage session cannot be completed faster than this many seconds per question
    min_seconds_per_question: float = 1.5
    session_ttl_minutes: int = 120
    cors_origins: str = "https://bingual.app"
    # Phase D (admin msg 4839, decision 1 = D): THE switch for real money. False = every real-money product is shown
    # "Coming soon" and checkout is refused. Turning it on also needs a provider adapter (services/payments.py).
    payments_enabled: bool = False
    payment_provider: str = ""          # adapter name, e.g. "zarinpal" or "google_play" once one is written
    # English Spell's own Web Push (VAPID). The private key lives only in the server .env (chmod 600), never in git.
    vapid_public_key: str = ""          # base64url, uncompressed P-256 point (the browser's applicationServerKey)
    vapid_private_key: str = ""         # base64url raw 32-byte P-256 private key
    vapid_subject: str = "mailto:info@bingual.app"
    app_url: str = "https://bingual.app/runecast/"

    @property
    def dsn(self) -> str:
        return (f"postgresql+asyncpg://{self.db_user}:{self.db_password}"
                f"@{self.db_host}:{self.db_port}/{self.db_name}")


@lru_cache
def get_settings() -> Settings:
    return Settings()
