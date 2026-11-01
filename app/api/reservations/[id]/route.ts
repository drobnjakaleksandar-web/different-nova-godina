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
  if (typeof body?.paid !== "boolean") return NextResponse.json({ error: "Neispravan zahtev." }, { status: 400 });
  const { error } = await db().from("reservations").update({ paid: body.paid }).eq("id", params.id);
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
