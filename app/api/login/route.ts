import { NextResponse } from "next/server";
import { checkPin, configProblem, isAuthed, setSessionCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  if (configProblem()) return NextResponse.json({ authed: false });
  return NextResponse.json({ authed: isAuthed() });
}

export async function POST(req: Request) {
  const problem = configProblem();
  if (problem) return NextResponse.json({ error: problem }, { status: 500 });
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
