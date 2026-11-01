import { NextResponse } from "next/server";
import { checkPin, isAuthed, setSessionCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ authed: isAuthed() });
}

export async function POST(req: Request) {
  let pin = "";
  try {
    const body = await req.json();
    pin = String(body?.pin ?? "").trim();
  } catch {}
  if (!checkPin(pin)) {
    // usporava pogađanje šifre
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.json({ error: "Pogrešna šifra." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  setSessionCookie(res);
  return res;
}
