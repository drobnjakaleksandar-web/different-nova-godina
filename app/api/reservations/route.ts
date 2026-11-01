import { NextResponse } from "next/server";
import { isAuthed, unauthorized } from "@/lib/session";
import { db, supabaseKey, supabaseUrl } from "@/lib/supabase";
import { TABLE_BY_NO } from "@/lib/tables";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isAuthed()) return unauthorized();
  if (!supabaseUrl() || !supabaseKey())
    return NextResponse.json({ error: "Baza nije povezana: u Vercelu fale SUPABASE_URL i SUPABASE_SECRET_KEY." }, { status: 500 });
  const { data, error } = await db()
    .from("reservations")
    .select("id, table_no, name, phone, seats, paid, created_at")
    .order("table_no", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    const detail = [error.code, error.message, (error as any).hint].filter(Boolean).join(" · ").slice(0, 300);
    return NextResponse.json({ error: `Baza ne odgovara (${detail || "nepoznata greška"})` }, { status: 500 });
  }
  return NextResponse.json({ reservations: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  if (!isAuthed()) return unauthorized();
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neispravan zahtev." }, { status: 400 });
  }
  const table = TABLE_BY_NO.get(Number(body?.table_no));
  const name = String(body?.name ?? "").trim().slice(0, 120);
  const phone = String(body?.phone ?? "").trim().slice(0, 40);
  const seats = Math.floor(Number(body?.seats));
  const paid = Boolean(body?.paid);
  if (!table) return NextResponse.json({ error: "Nepostojeći sto." }, { status: 400 });
  if (!name) return NextResponse.json({ error: "Upišite ime gosta ili grupe." }, { status: 400 });
  if (!(seats >= 1 && seats <= table.cap))
    return NextResponse.json({ error: "Neispravan broj mesta." }, { status: 400 });

  const { data, error } = await db().rpc("add_reservation", {
    p_table: table.n, p_cap: table.cap, p_name: name, p_phone: phone, p_seats: seats, p_paid: paid
  });
  if (error) return NextResponse.json({ error: "Upis nije sačuvan. Pokušajte ponovo." }, { status: 500 });
  if (!data?.ok) {
    const free = Number(data?.free ?? 0);
    return NextResponse.json(
      { error: free > 0 ? `Za stolom ${table.n} je ostalo samo ${free} mesta.` : `Sto ${table.n} je u međuvremenu popunjen.` },
      { status: 409 }
    );
  }
  return NextResponse.json({ ok: true, id: data.id });
}
