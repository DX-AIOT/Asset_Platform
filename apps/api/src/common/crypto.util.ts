import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;   // 96-bit IV recommended for GCM
const TAG_BYTES = 16;  // 128-bit auth tag

/**
 * Encrypts a plaintext string with AES-256-GCM.
 * Returns a dot-separated base64url string: iv.tag.ciphertext
 * @param keyHex 64-char hex string (32 bytes)
 */
export function encryptToken(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}

/**
 * Decrypts a token encrypted with encryptToken.
 * @param keyHex 64-char hex string (32 bytes)
 */
export function decryptToken(encryptedToken: string, keyHex: string): string {
  const parts = encryptedToken.split('.');
  if (parts.length !== 3) throw new Error('Invalid encrypted token format');
  const [ivB64, tagB64, dataB64] = parts;
  const key = Buffer.from(keyHex, 'hex');
  const iv = Buffer.from(ivB64, 'base64url');
  const tag = Buffer.from(tagB64, 'base64url');
  const data = Buffer.from(dataB64, 'base64url');
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new Error('Invalid encrypted token length');
  }
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(data).toString('utf8') + decipher.final('utf8');
}
