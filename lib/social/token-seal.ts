import crypto from "crypto";

const PREFIX = "agently:v1:";

export function sealToken(token?: string | null) {
  if (!token) return null;
  const key = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;
  if (!key) return `${PREFIX}base64:${Buffer.from(token, "utf8").toString("base64")}`;

  const keyBytes = crypto.createHash("sha256").update(key).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", keyBytes, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}aesgcm:${Buffer.concat([iv, tag, encrypted]).toString("base64")}`;
}

export function unsealToken(value?: string | null) {
  if (!value?.startsWith(PREFIX)) return null;
  const [, mode, payload] = value.match(/^agently:v1:([^:]+):(.+)$/) ?? [];
  if (!mode || !payload) return null;

  if (mode === "base64") return Buffer.from(payload, "base64").toString("utf8");
  if (mode !== "aesgcm" || !process.env.SOCIAL_TOKEN_ENCRYPTION_KEY) return null;

  try {
    const raw = Buffer.from(payload, "base64");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const encrypted = raw.subarray(28);
    const keyBytes = crypto.createHash("sha256").update(process.env.SOCIAL_TOKEN_ENCRYPTION_KEY).digest();
    const decipher = crypto.createDecipheriv("aes-256-gcm", keyBytes, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
