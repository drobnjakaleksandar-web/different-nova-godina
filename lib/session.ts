import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const COOKIE = "ng_session";
const MAX_AGE_S = 60 * 60 * 24 * 90; // 90 dana

function secret() {
  const s = process.env.SESSION_SECRET;
  const pin = envPin();
  if (!s || s.length < 16) throw new Error("SESSION_SECRET nije podešen (min 16 znakova)");
  if (!pin) throw new Error("APP_PIN nije podešen");
  // Šifra je deo ključa: promena šifre odjavljuje sve uređaje.
  return s + "|" + pin;
}

// Uklanja razmake i navodnike koji se slučajno nalepe u Vercelu
export function envPin() {
  return (process.env.APP_PIN || "").trim().replace(/^["']|["']$/g, "").trim();
}

export function configProblem(): string | null {
  if (!envPin()) return "Šifra nije podešena na serveru. U Vercelu dodajte APP_PIN pa uradite Redeploy.";
  const s = process.env.SESSION_SECRET || "";
  if (s.length < 16) return "SESSION_SECRET nije podešen ili je kraći od 16 znakova. Ispravite u Vercelu pa uradite Redeploy.";
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
  const real = envPin();
  return real.length > 0 && safeEqual(pin, real);
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
