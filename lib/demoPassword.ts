import { randomBytes, scrypt as _scrypt, timingSafeEqual, ScryptOptions } from "crypto";

function scrypt(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    _scrypt(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

// Pure Node.js password hashing for the staging-only demo Credentials provider.
//
// We intentionally avoid `argon2` here: it is a native C++ addon whose prebuilt
// binary is not reliably bundled into Vercel's serverless functions, which made
// its top-level import crash the ENTIRE NextAuth handler (every /api/auth/* route
// 500'd). Node's built-in scrypt is a strong KDF, needs no native build, and runs
// anywhere. Format: `scrypt$<N>$<r>$<p>$<saltB64>$<hashB64>`.

const N = 16384; // CPU/memory cost
const R = 8; // block size
const P = 1; // parallelization
const KEYLEN = 32;

export async function hashDemoPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, KEYLEN, { N, r: R, p: P })) as Buffer;
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

export async function verifyDemoPassword(stored: string, password: string): Promise<boolean> {
  try {
    const parts = stored.split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;
    const [, nStr, rStr, pStr, saltB64, hashB64] = parts;
    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(hashB64, "base64");
    const derived = (await scrypt(password, salt, expected.length, {
      N: parseInt(nStr, 10),
      r: parseInt(rStr, 10),
      p: parseInt(pStr, 10),
    })) as Buffer;
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}
