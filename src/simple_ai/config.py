import os
from pathlib import Path
from typing import List
from dotenv import load_dotenv

# ------------------------------------------------------------------------------
# 1. Dynamic Environment Resolution (dev / stage / prod)
# ------------------------------------------------------------------------------
# Default environment is development unless overridden by APP_ENV
APP_ENV = os.getenv("APP_ENV", "development").strip().lower()

# Map common aliases (e.g. dev -> development, prod -> production)
ENV_ALIASES = {
    "dev": "development",
    "stage": "staging",
    "prod": "production",
}
APP_ENV = ENV_ALIASES.get(APP_ENV, APP_ENV)

# Look for specific environment file (.env.development, .env.staging, .env.production)
base_dir = Path(__file__).resolve().parent.parent.parent
env_specific_file = base_dir / f".env.{APP_ENV}"
default_env_file = base_dir / ".env"

if env_specific_file.exists():
    load_dotenv(dotenv_path=env_specific_file, override=True)
elif default_env_file.exists():
    load_dotenv(dotenv_path=default_env_file, override=True)
else:
    load_dotenv()


# ------------------------------------------------------------------------------
# 2. Environment Settings Class
# ------------------------------------------------------------------------------
class Settings:
    """Centralized multi-environment configuration settings."""

    # Environment Identity
    APP_ENV: str = os.getenv("APP_ENV", APP_ENV)
    DEBUG: bool = os.getenv("DEBUG", "False").lower() in ("true", "1", "yes")
    PORT: int = int(os.getenv("PORT", "8000"))
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO" if APP_ENV != "development" else "DEBUG")

    @property
    def is_development(self) -> bool:
        return self.APP_ENV == "development"

    @property
    def is_staging(self) -> bool:
        return self.APP_ENV == "staging"

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"

    # API Documentation URLs (Disabled or restricted in production)
    @property
    def docs_url(self) -> str | None:
        if self.is_production:
            return os.getenv("DOCS_URL", None)  # None disables Swagger UI in prod
        return "/docs"

    @property
    def redoc_url(self) -> str | None:
        if self.is_production:
            return os.getenv("REDOC_URL", None)
        return "/redoc"

    # LLM & Embedding Settings
    API_KEY: str = (
        os.getenv("GEMINI_API_KEY")
        or os.getenv("OPENAI_API_KEY")
        or "dummy-api-key-for-test-environments"
    )
    BASE_URL: str = os.getenv("BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai/")
    MODEL: str = os.getenv("MODEL", "gemini-2.5-flash")
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "gemini-embedding-001")
    EMBEDDING_DIM: int = int(os.getenv("EMBEDDING_DIM", "768"))

    # Database Settings
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/simple_ai",
    )
    VECTOR_DATABASE_URL: str = os.getenv("VECTOR_DATABASE_URL", DATABASE_URL)

    # Database Pool Tuning (Environment-adaptive)
    DB_POOL_SIZE: int = int(os.getenv("DB_POOL_SIZE", "5" if APP_ENV == "development" else "15"))
    DB_MAX_OVERFLOW: int = int(os.getenv("DB_MAX_OVERFLOW", "10" if APP_ENV == "development" else "25"))

    # Security & JWT Tokens
    JWT_SECRET_KEY: str = os.getenv(
        "JWT_SECRET_KEY", "simple-ai-fallback-secret-key-32bytes-min"
    )
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

    # Ingestion Pipeline Chunking
    CHUNK_SIZE: int = int(os.getenv("CHUNK_SIZE", "800"))
    CHUNK_OVERLAP: int = int(os.getenv("CHUNK_OVERLAP", "150"))

    # Request Transport Security (HSTS & TLS Enforcement)
    HSTS_ENABLED: bool = os.getenv("HSTS_ENABLED", "True").lower() in ("true", "1", "yes")
    HSTS_MAX_AGE: int = int(os.getenv("HSTS_MAX_AGE", "31536000"))  # 1 year in seconds
    HSTS_INCLUDE_SUBDOMAINS: bool = os.getenv("HSTS_INCLUDE_SUBDOMAINS", "True").lower() in ("true", "1", "yes")
    HSTS_PRELOAD: bool = os.getenv("HSTS_PRELOAD", "True").lower() in ("true", "1", "yes")
    ENFORCE_HTTPS: bool = os.getenv("ENFORCE_HTTPS", "True" if APP_ENV == "production" else "False").lower() in ("true", "1", "yes")
    SECURE_REFERRER_POLICY: str = os.getenv("SECURE_REFERRER_POLICY", "strict-origin-when-cross-origin")

    @property
    def hsts_header_value(self) -> str:
        """Constructs RFC 6797 Strict-Transport-Security header value."""
        parts = [f"max-age={self.HSTS_MAX_AGE}"]
        if self.HSTS_INCLUDE_SUBDOMAINS:
            parts.append("includeSubDomains")
        if self.HSTS_PRELOAD:
            parts.append("preload")
        return "; ".join(parts)

    # CORS & Web Client Domains
    @property
    def cors_origins(self) -> List[str]:
        raw = os.getenv("CORS_ORIGINS", "")
        if raw:
            return [x.strip() for x in raw.split(",") if x.strip()]
        if self.is_development:
            return ["*"]
        return ["https://app.simple-ai.dev"]

    FRONTEND_URL: str = os.getenv(
        "FRONTEND_URL",
        "http://localhost:3000" if APP_ENV == "development" else "https://app.simple-ai.dev",
    )

    DEFAULT_FALLBACK_JWT_SECRET: str = "simple-ai-fallback-secret-key-32bytes-min"

    def validate_security(self) -> None:
        """Enforces critical cryptographic and transport security rules."""
        import logging
        cfg_logger = logging.getLogger("simple_ai.config")

        if self.is_production or self.is_staging:
            if not self.JWT_SECRET_KEY or self.JWT_SECRET_KEY == self.DEFAULT_FALLBACK_JWT_SECRET:
                raise RuntimeError(
                    f"CRITICAL SECURITY CONFIGURATION ERROR: A strong, unique JWT_SECRET_KEY must be provided in {self.APP_ENV} mode! "
                    "Cannot use default static fallback key. Generate with `openssl rand -hex 32`."
                )
            if len(self.JWT_SECRET_KEY) < 32:
                raise RuntimeError(
                    f"CRITICAL SECURITY CONFIGURATION ERROR: JWT_SECRET_KEY must be at least 32 characters in {self.APP_ENV}."
                )
        elif self.JWT_SECRET_KEY == self.DEFAULT_FALLBACK_JWT_SECRET:
            cfg_logger.warning(
                "SECURITY WARNING: Using default static JWT_SECRET_KEY in development. "
                "Ensure a secure 32+ character random secret is set for staging and production."
            )


settings = Settings()
settings.validate_security()


# Backward-compatible direct exports
API_KEY = settings.API_KEY
BASE_URL = settings.BASE_URL
MODEL = settings.MODEL
EMBEDDING_MODEL = settings.EMBEDDING_MODEL
EMBEDDING_DIM = settings.EMBEDDING_DIM
DATABASE_URL = settings.DATABASE_URL
VECTOR_DATABASE_URL = settings.VECTOR_DATABASE_URL
JWT_SECRET_KEY = settings.JWT_SECRET_KEY
JWT_ALGORITHM = settings.JWT_ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES
CHUNK_SIZE = settings.CHUNK_SIZE
CHUNK_OVERLAP = settings.CHUNK_OVERLAP
FRONTEND_URL = settings.FRONTEND_URL