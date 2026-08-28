import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

export interface AuthorizationCodePayload {
  type: "authorization_code";
  gw2Key: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  resource: string;
  scope: string;
  expiresAt: number;
}

export interface AccessTokenPayload {
  type: "access_token";
  gw2Key: string;
  audience: string;
  scope: string;
  issuedAt: number;
  expiresAt: number;
}

export type OAuthPayload = AuthorizationCodePayload | AccessTokenPayload;

function encryptionKey(): Buffer {
  const secret = process.env.OAUTH_SECRET?.trim();
  if (!secret) throw new Error("OAUTH_SECRET is not configured");
  return createHash("sha256").update(secret, "utf8").digest();
}

export function sealToken(payload: OAuthPayload): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), ciphertext.toString("base64url"), cipher.getAuthTag().toString("base64url")].join(".");
}

export function openToken(token: string): OAuthPayload {
  const [version, encodedIv, encodedCiphertext, encodedTag] = token.split(".");
  if (version !== "v1" || !encodedIv || !encodedCiphertext || !encodedTag) {
    throw new Error("Invalid token format");
  }

  try {
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(encodedIv, "base64url"));
    decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(encodedCiphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    const payload = JSON.parse(plaintext) as OAuthPayload;
    if (!payload || (payload.type !== "authorization_code" && payload.type !== "access_token")) {
      throw new Error("Invalid token payload");
    }
    if (!Number.isFinite(payload.expiresAt) || payload.expiresAt <= Date.now()) {
      throw new Error("Token expired");
    }
    return payload;
  } catch (error) {
    if (error instanceof Error && (error.message === "Token expired" || error.message === "Invalid token payload")) {
      throw error;
    }
    throw new Error("Invalid token");
  }
}

export function verifyPkce(verifier: string, expectedChallenge: string): boolean {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return false;
  const actual = createHash("sha256").update(verifier, "ascii").digest();
  const expected = Buffer.from(expectedChallenge, "base64url");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
