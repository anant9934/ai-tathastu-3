"""Opens connector credentials sealed by src/lib/connectors/crypto.ts.

Layout (v1): 0x01 | iv (12) | ciphertext | GCM tag (16), AES-256-GCM,
key = base64 CONNECTOR_TOKEN_KEY, AAD = "<user_id>:<source_id>".
"""

from __future__ import annotations

import base64
import json
import os
from typing import Any, Dict

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

VERSION = 1


def _key() -> bytes:
    key = base64.b64decode(os.environ.get("CONNECTOR_TOKEN_KEY", ""))
    if len(key) != 32:
        raise RuntimeError("CONNECTOR_TOKEN_KEY must be 32 bytes, base64-encoded")
    return key


def open_credential(blob: bytes, user_id: str, source_id: str) -> Dict[str, Any]:
    blob = bytes(blob)  # psycopg2 returns bytea as memoryview
    if blob[0] != VERSION:
        raise ValueError(f"unknown token_enc version {blob[0]}")
    iv, sealed = blob[1:13], blob[13:]  # AESGCM wants ciphertext || tag
    plaintext = AESGCM(_key()).decrypt(iv, sealed, f"{user_id}:{source_id}".encode())
    return json.loads(plaintext)
