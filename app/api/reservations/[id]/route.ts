import { NextResponse } from "next/server";
import { isAuthed, unauthorized } from "@/lib/session";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!isAuthed()) return unauthorized();
  if (!UUID.test(params.id)) return NextResponse.json({ error: "Neispravan zahtev." }, { status: 400 });
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neispravan zahtev." }, { status: 400 });
  }
  const patch: { paid?: boolean; name?: string; phone?: string } = {};
  if (typeof body?.paid === "boolean") patch.paid = body.paid;
  if (typeof body?.name === "string") {
    const name = body.name.trim().slice(0, 120);
    if (!name) return NextResponse.json({ error: "Ime ne može biti prazno." }, { status: 400 });
    patch.name = name;
  }
  if (typeof body?.phone === "string") patch.phone = body.phone.trim().slice(0, 40);
  if (!Object.keys(patch).length) return NextResponse.json({ error: "Neispravan zahtev." }, { status: 400 });
  const { error } = await db().from("reservations").update(patch).eq("id", params.id);
  if (error) return NextResponse.json({ error: "Izmena nije sačuvana." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!isAuthed()) return unauthorized();
  if (!UUID.test(params.id)) return NextResponse.json({ error: "Neispravan zahtev." }, { status: 400 });
  const { error } = await db().from("reservations").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: "Brisanje nije uspelo." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
