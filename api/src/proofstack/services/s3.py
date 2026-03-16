"""S3-compatible storage for evidence artifacts."""

import uuid
from typing import BinaryIO

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from proofstack.core.config import settings


def _client():
    kwargs = {
        "service_name": "s3",
        "region_name": settings.s3_region,
        "aws_access_key_id": settings.s3_access_key_id or None,
        "aws_secret_access_key": settings.s3_secret_access_key or None,
        "config": Config(
            signature_version="s3v4",
            s3={"addressing_style": "path"} if settings.s3_force_path_style else {},
        ),
    }
    if settings.s3_endpoint_url:
        kwargs["endpoint_url"] = settings.s3_endpoint_url
    return boto3.client(**kwargs)


def make_evidence_key(prefix: str = "evidence", file_name: str | None = None) -> str:
    """Generate a unique S3 key for an evidence artifact."""
    unique = uuid.uuid4().hex
    if file_name:
        safe_name = file_name.replace(" ", "_").split("/")[-1]
        return f"{prefix}/{unique}_{safe_name}"
    return f"{prefix}/{unique}"


def upload_evidence(s3_key: str, body: BinaryIO, content_type: str) -> None:
    """Upload a single object to S3."""
    client = _client()
    extra = {}
    if content_type:
        extra["ContentType"] = content_type
    client.upload_fileobj(body, settings.s3_bucket, s3_key, ExtraArgs=extra)


def download_evidence(s3_key: str) -> bytes:
    """Download object bytes from S3."""
    client = _client()
    resp = client.get_object(Bucket=settings.s3_bucket, Key=s3_key)
    return resp["Body"].read()


def generate_presigned_download_url(s3_key: str, expires_in: int = 3600) -> str:
    """Generate a presigned URL for downloading an artifact."""
    client = _client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.s3_bucket, "Key": s3_key},
        ExpiresIn=expires_in,
    )


def delete_evidence(s3_key: str) -> None:
    """Delete an object from S3."""
    client = _client()
    client.delete_object(Bucket=settings.s3_bucket, Key=s3_key)


def bucket_exists() -> bool:
    """Check if the configured bucket exists (for health checks)."""
    try:
        _client().head_bucket(Bucket=settings.s3_bucket)
        return True
    except ClientError:
        return False
