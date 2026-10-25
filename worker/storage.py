"""Reads uploaded files from Cloudflare R2 (or a local folder in dev/tests)."""

from __future__ import annotations

import os
from pathlib import Path

MAX_BYTES = 10 * 1024 * 1024


class StorageError(Exception):
    pass


def read_object(key: str) -> bytes:
    """
    Returns the object's bytes, refusing anything over the 10 MB upload limit.
    Set WORKER_LOCAL_STORAGE_DIR to read <dir>/<key> instead of R2.
    """
    local = os.environ.get("WORKER_LOCAL_STORAGE_DIR")
    if local:
        path = (Path(local) / key).resolve()
        if not str(path).startswith(str(Path(local).resolve())):
            raise StorageError("storage key escapes the local storage dir")
        if not path.exists():
            raise StorageError(f"object not found: {key}")
        if path.stat().st_size > MAX_BYTES:
            raise StorageError("object exceeds 10 MB")
        return path.read_bytes()

    import boto3  # imported lazily so tests don't need AWS config
    from botocore.config import Config

    account = os.environ.get("R2_ACCOUNT_ID")
    bucket = os.environ.get("R2_BUCKET")
    if not account or not bucket:
        raise StorageError("R2_ACCOUNT_ID / R2_BUCKET not set")
    s3 = boto3.client(
        "s3",
        endpoint_url=f"https://{account}.r2.cloudflarestorage.com",
        aws_access_key_id=os.environ.get("R2_ACCESS_KEY_ID"),
        aws_secret_access_key=os.environ.get("R2_SECRET_ACCESS_KEY"),
        region_name="auto",
        config=Config(retries={"max_attempts": 3, "mode": "standard"}),
    )
    head = s3.head_object(Bucket=bucket, Key=key)
    if head["ContentLength"] > MAX_BYTES:
        raise StorageError("object exceeds 10 MB")
    return s3.get_object(Bucket=bucket, Key=key)["Body"].read(MAX_BYTES + 1)
