// 비밀번호 해시(서버 전용). 시트에 평문 대신 scrypt 해시만 저장한다.
//   저장 형식: "scrypt:<salt-hex>:<hash-hex>"
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, 32);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  if (!stored) return false;
  const parts = stored.split(":");
  // 과거 평문 저장분 호환(혹시 있으면): 평문 직접 비교
  if (parts.length !== 3 || parts[0] !== "scrypt") return plain === stored;
  const [, saltHex, hashHex] = parts;
  try {
    const hash = Buffer.from(hashHex, "hex");
    const test = scryptSync(plain, Buffer.from(saltHex, "hex"), hash.length);
    return hash.length === test.length && timingSafeEqual(hash, test);
  } catch {
    return false;
  }
}
