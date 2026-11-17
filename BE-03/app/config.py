from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Nexvia API Platform"
    environment: str = "dev"
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/nexvia_api"
    redis_url: str = "redis://localhost:6379/0"
    admin_token: str = "admin-demo-token"
    free_rate_per_minute: int = 10
    pro_rate_per_minute: int = 100
    free_monthly_quota: int = 1000
    pro_monthly_quota: int = 100000
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()

PLANS: dict[str, dict] = {
    "free": {
        "name": "Free",
        "price_cents": 0,
        "rate_per_minute": settings.free_rate_per_minute,
        "monthly_quota": settings.free_monthly_quota,
        "description": "For prototypes and hobby projects",
    },
    "pro": {
        "name": "Pro",
        "price_cents": 1900,
        "rate_per_minute": settings.pro_rate_per_minute,
        "monthly_quota": settings.pro_monthly_quota,
        "description": "For production workloads with higher limits",
    },
}
