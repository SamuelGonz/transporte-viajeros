// Autenticación mínima de un solo usuario mediante variables de entorno.
// La sesión se guarda en una cookie firmada con HMAC-SHA256 (Web Crypto),
// compatible tanto con el middleware (Edge) como con las rutas API (Node).

export const AUTH_COOKIE = "tv_auth";
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30; // 30 días

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function getSecret(): string {
  // Si no se define AUTH_SECRET, derivamos uno de las credenciales para que
  // funcione "out of the box"; cambiar la contraseña invalida las sesiones.
  return (
    process.env.AUTH_SECRET ||
    `${process.env.AUTH_USERNAME ?? ""}:${process.env.AUTH_PASSWORD ?? ""}:tv-secret`
  );
}

function bytesToBase64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToBytes(str: string): Uint8Array {
  const b64 =
    str.replace(/-/g, "+").replace(/_/g, "/") +
    "=".repeat((4 - (str.length % 4)) % 4);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function strToBase64url(s: string): string {
  return bytesToBase64url(encoder.encode(s));
}

function base64urlToStr(s: string): string {
  return decoder.decode(base64urlToBytes(s));
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return bytesToBase64url(new Uint8Array(sig));
}

// Comparación en tiempo constante para evitar filtrar información por timing.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// Comprueba usuario y contraseña contra las variables de entorno.
export function checkCredentials(username: string, password: string): boolean {
  const U = process.env.AUTH_USERNAME;
  const P = process.env.AUTH_PASSWORD;
  if (!U || !P) return false;
  return safeEqual(username, U) && safeEqual(password, P);
}

export async function createToken(username: string): Promise<string> {
  const payload = strToBase64url(
    JSON.stringify({ u: username, exp: Date.now() + MAX_AGE_MS })
  );
  const sig = await hmac(payload);
  return `${payload}.${sig}`;
}

export async function verifyToken(token?: string | null): Promise<boolean> {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;

  const expected = await hmac(payload);
  if (!safeEqual(sig, expected)) return false;

  try {
    const data = JSON.parse(base64urlToStr(payload));
    if (typeof data.exp === "number" && Date.now() > data.exp) return false;
    return true;
  } catch {
    return false;
  }
}

export const COOKIE_MAX_AGE = Math.floor(MAX_AGE_MS / 1000);
