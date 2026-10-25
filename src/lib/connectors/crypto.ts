import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Sealed connector credentials, stored in connections.token_enc.
 *
 * Layout (v1): 0x01 | iv (12 bytes) | ciphertext | GCM tag (16 bytes)
 * Cipher: AES-256-GCM, key = base64-decoded CONNECTOR_TOKEN_KEY (32 bytes),
 * AAD = "<user_id>:<source_id>", so a blob copied onto another user's or
 * source's row fails to decrypt. The worker opens these with
 * worker/crypto_box.py (ciphertext||tag is what Python's AESGCM expects).
 */

const VERSION = 1;

function key(): Buffer {
  const raw = process.env.CONNECTOR_TOKEN_KEY;
  const buf = raw ? Buffer.from(raw, "base64") : null;
  if (!buf || buf.length !== 32) {
    throw new Error("CONNECTOR_TOKEN_KEY must be 32 bytes, base64-encoded (openssl rand -base64 32).");
  }
  return buf;
}

export function isConnectorCryptoConfigured() {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}

export function seal(plaintext: object, aad: string): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(aad));
  const body = Buffer.concat([cipher.update(JSON.stringify(plaintext), "utf8"), cipher.final()]);
  return Buffer.concat([Buffer.from([VERSION]), iv, body, cipher.getAuthTag()]);
}

export function open<T>(blob: Buffer, aad: string): T {
  if (blob[0] !== VERSION) throw new Error(`Unknown token_enc version ${blob[0]}`);
  const iv = blob.subarray(1, 13);
  const tag = blob.subarray(blob.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(tag);
  const text = Buffer.concat([decipher.update(blob.subarray(13, blob.length - 16)), decipher.final()]).toString("utf8");
  return JSON.parse(text) as T;
}

export const credentialAad = (userId: string, sourceId: string) => `${userId}:${sourceId}`;
