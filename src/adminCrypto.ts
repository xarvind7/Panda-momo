export interface AdminPasswordDigest {
  algorithm: 'PBKDF2-SHA256';
  iterations: number;
  saltHex: string;
  hashHex: string;
}

// Pre-computed salted PBKDF2-SHA256 digest (plaintext password is never stored in code)
export const DEFAULT_ADMIN_DIGEST: AdminPasswordDigest = {
  algorithm: 'PBKDF2-SHA256',
  iterations: 120000,
  saltHex: '47edd869229dd4eb5eb7842f06bfd05e',
  hashHex: 'eeaaec6cece6bc651043833244666e2cfbdf08054b359a96163c4384fb58e462',
};

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().toLowerCase();
  const len = Math.floor(clean.length / 2);
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16) || 0;
  }
  return out;
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  const normA = a.trim().toLowerCase();
  const normB = b.trim().toLowerCase();
  if (normA.length === 0 || normA.length !== normB.length) return false;
  let diff = 0;
  for (let i = 0; i < normA.length; i++) {
    diff |= normA.charCodeAt(i) ^ normB.charCodeAt(i);
  }
  return diff === 0;
}

export async function derivePasswordHashHex(
  password: string,
  saltHex: string,
  iterations = DEFAULT_ADMIN_DIGEST.iterations
): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Web Crypto SubtleCrypto unavailable');
  }
  const encoder = new TextEncoder();
  const keyMaterial = await subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const saltBytes = hexToBytes(saltHex);
  const saltBuffer = saltBytes.buffer.slice(
    saltBytes.byteOffset,
    saltBytes.byteOffset + saltBytes.byteLength
  ) as ArrayBuffer;
  const bits = await subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return bytesToHex(new Uint8Array(bits));
}

export async function createPasswordDigest(
  password: string,
  iterations = DEFAULT_ADMIN_DIGEST.iterations
): Promise<AdminPasswordDigest> {
  const saltBytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(saltBytes);
  const saltHex = bytesToHex(saltBytes);
  const hashHex = await derivePasswordHashHex(password, saltHex, iterations);
  return {
    algorithm: 'PBKDF2-SHA256',
    iterations,
    saltHex,
    hashHex,
  };
}

export async function verifyPasswordAgainstDigest(
  password: string,
  digest: AdminPasswordDigest = DEFAULT_ADMIN_DIGEST
): Promise<boolean> {
  if (!password || !digest?.saltHex || !digest?.hashHex) return false;
  try {
    const derived = await derivePasswordHashHex(
      password,
      digest.saltHex,
      digest.iterations || DEFAULT_ADMIN_DIGEST.iterations
    );
    return timingSafeEqualHex(derived, digest.hashHex);
  } catch {
    return false;
  }
}
