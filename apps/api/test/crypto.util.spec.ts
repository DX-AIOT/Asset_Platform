import { encryptToken, decryptToken } from '../src/common/crypto.util';

const KEY_HEX = 'a'.repeat(64); // 32 bytes of 0xAA — valid for testing

describe('crypto.util (AES-256-GCM)', () => {
  it('round-trips a push token', () => {
    const original = 'ExponentPushToken[abc123XYZ]';
    const encrypted = encryptToken(original, KEY_HEX);
    expect(encrypted).not.toBe(original);
    expect(encrypted.split('.')).toHaveLength(3);

    const decrypted = decryptToken(encrypted, KEY_HEX);
    expect(decrypted).toBe(original);
  });

  it('produces different ciphertext on each call (random IV)', () => {
    const token = 'ExponentPushToken[sameToken]';
    const enc1 = encryptToken(token, KEY_HEX);
    const enc2 = encryptToken(token, KEY_HEX);
    expect(enc1).not.toBe(enc2);
    expect(decryptToken(enc1, KEY_HEX)).toBe(token);
    expect(decryptToken(enc2, KEY_HEX)).toBe(token);
  });

  it('throws on tampered ciphertext (auth tag mismatch)', () => {
    const encrypted = encryptToken('ExponentPushToken[secret]', KEY_HEX);
    const [iv, tag, data] = encrypted.split('.');
    const tampered = [iv, tag, data.slice(0, -2) + 'xx'].join('.');
    expect(() => decryptToken(tampered, KEY_HEX)).toThrow();
  });

  it('throws on malformed token (wrong part count)', () => {
    expect(() => decryptToken('not.valid', KEY_HEX)).toThrow('Invalid encrypted token format');
  });
});
