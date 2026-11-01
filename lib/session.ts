import { createHash, createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const COOKIE = "ng_session";
const MAX_AGE_S = 60 * 60 * 24 * 90; // 90 dana

// Rezervne vrednosti kada u Vercelu nije podešeno APP_PIN / SESSION_SECRET.
// Šifra se ovde ne čuva, samo njen otisak. APP_PIN u Vercelu uvek ima prednost.
const DEFAULT_PIN_HASH = "29a54381403b3a9379a93f5fb0450fe41b02329ef8b443310df81e94e79b8ed5";
const DEFAULT_SECRET = "A-qrEsHlX2SudhWt2nB9ZAtfUPwPqvbAU15sNfPeieDpxtEW";
const pinHash = (pin: string) => createHash("sha256").update("different-ng:" + pin).digest("hex");

function secret() {
  const env = process.env.SESSION_SECRET || "";
  const s = env.length >= 16 ? env : DEFAULT_SECRET;
  // Šifra je deo ključa: promena šifre odjavljuje sve uređaje.
  return s + "|" + (envPin() || DEFAULT_PIN_HASH);
}

// Uklanja razmake i navodnike koji se slučajno nalepe u Vercelu
export function envPin() {
  return (process.env.APP_PIN || "").trim().replace(/^["']|["']$/g, "").trim();
}

export function configProblem(): string | null {
  return null;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function checkPin(pin: string) {
  if (!pin) return false;
  const real = envPin();
  if (real) return safeEqual(pin, real);
  return safeEqual(pinHash(pin), DEFAULT_PIN_HASH);
}

export function makeToken() {
  const exp = String(Math.floor(Date.now() / 1000) + MAX_AGE_S);
  return `${exp}.${sign(exp)}`;
}

export function isAuthed(): boolean {
  const v = cookies().get(COOKIE)?.value;
  if (!v) return false;
  const [exp, sig] = v.split(".");
  if (!exp || !sig) return false;
  if (Number(exp) < Date.now() / 1000) return false;
  try {
    return safeEqual(sig, sign(exp));
  } catch {
    return false;
  }
}

export function setSessionCookie(res: NextResponse) {
  res.cookies.set(COOKIE, makeToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_S
  });
}

export function unauthorized() {
  return NextResponse.json({ error: "Potrebna je prijava." }, { status: 401 });
}
