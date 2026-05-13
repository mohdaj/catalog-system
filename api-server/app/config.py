from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://ubg_catalog_app:9FCvNjS2TIjSX8KixqVJrynxOq@ubg-server:5432/catalog_db"
    APP_NAME: str = "Catalog System"
    DEBUG: bool = False

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
