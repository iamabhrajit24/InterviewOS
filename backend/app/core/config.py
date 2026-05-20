from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """
    App settings loaded from the .env file.
    pydantic-settings automatically reads .env when env_file is set.
    Do NOT use os.getenv() inside a BaseSettings class — it bypasses the loader.
    """
    GROQ_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    AI_PRIMARY: str = "groq"
    AI_FALLBACK: str = "gemini"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    PORT: int = 8000

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore"
    }

settings = Settings()
