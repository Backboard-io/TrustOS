"""Application configuration from environment."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # App
    app_name: str = "ProofStack API"
    debug: bool = False

    # Backboard
    backboard_api_key: str
    backboard_assistant_id: str  # legacy / kept for reference
    users_assistant_id: str      # auth store: all user records
    trust_assistant_id: str | None = None  # optional: global trust center
    registry_assistant_id: str | None = None  # optional: app_id -> assistant_id for public trust lookup

    # S3-compatible storage
    s3_endpoint_url: str | None = None
    s3_region: str = "us-east-1"
    s3_bucket: str = "proofstack-evidence"
    s3_access_key_id: str = ""
    s3_secret_access_key: str = ""
    s3_force_path_style: bool = False

    # Auth (API key or JWT)
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    api_key_header: str = "X-API-Key"

    # Temporal
    temporal_host: str = "localhost"
    temporal_port: int = 7233
    temporal_namespace: str = "default"
    temporal_task_queue: str = "proofstack"

    # Integrations (optional)
    slack_webhook_url: str | None = None
    jira_base_url: str | None = None
    jira_email: str | None = None
    jira_api_token: str | None = None


settings = Settings()
