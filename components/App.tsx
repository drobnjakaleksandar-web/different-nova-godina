"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Reservation, Table, TABLES, TABLE_BY_NO, TOTAL_CAP, ZONES, ZONE_KEYS, ZoneKey } from "@/lib/tables";

const POLL_MS = 4000;

const eur = (v: number) => v.toLocaleString("sr-RS") + " €";
const mesta = (n: number) => (n === 1 ? "mesto" : "mesta");
const slobodnih = (f: number) => {
  const m10 = f % 10, m100 = f % 100;
  if (m10 === 1 && m100 !== 11) return "slobodno mesto";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "slobodna mesta";
  return "slobodnih mesta";
};

async function api<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store"
  });
  let body: any = null;
  try { body = await res.json(); } catch {}
  if (!res.ok) {
    const err: any = new Error(body?.error || "Greška u vezi. Pokušajte ponovo.");
    err.status = res.status;
    throw err;
  }
  return body as T;
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/* ---------------- root ---------------- */

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    api<{ authed: boolean }>("/api/login").then((r) => setAuthed(r.authed)).catch(() => setAuthed(false));
  }, []);
  if (authed === null) return <div className="loading">Učitavanje…</div>;
  if (!authed) return <Login onOk={() => setAuthed(true)} />;
  return <Main onLogout={() => setAuthed(false)} />;
}

function Login({ onOk }: { onOk: () => void }) {
  const [pin, setPin] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!pin.trim()) { setErr("Upišite šifru."); return; }
    setBusy(true); setErr("");
    try { await api("/api/login", { method: "POST", body: JSON.stringify({ pin }) }); onOk(); }
    catch (e: any) { setErr(e.message); setBusy(false); }
  }
  return (
    <main className="login">
      <form onSubmit={submit}>
        <div>
          <h1>Restoran Different · <span style={{ color: "var(--gold)" }}>Nova Godina 2027</span></h1>
          <div className="sub">Evidencija prodaje mesta</div>
        </div>
        <label className="sec-t" htmlFor="pin">Šifra</label>
        <input id="pin" className="field" type={show ? "text" : "password"} autoComplete="current-password"
          autoCapitalize="none" autoCorrect="off" spellCheck={false}
          value={pin} onChange={(e) => setPin(e.target.value)} autoFocus />
        <button type="button" className="ghost" onClick={() => setShow((v) => !v)}>
          {show ? "Sakrij šifru" : "Prikaži šifru"}
        </button>
        {err && <p className="err">{err}</p>}
        <button className="primary" disabled={busy}>{busy ? "Provera…" : "Uđi"}</button>
      </form>
    </main>
  );
}

/* ---------------- main ---------------- */

type Mode = { kind: "table"; n: number } | { kind: "list" } | { kind: "copy"; title: string; text: string } | null;

function Main({ onLogout }: { onLogout: () => void }) {
  const [rows, setRows] = useState<Reservation[] | null>(null);
  const [syncOk, setSyncOk] = useState(true);
  const [syncErr, setSyncErr] = useState("");
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<Mode>(null);
  const [toastMsg, setToastMsg] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const [zoom, setZoom] = useState(false);

  const toast = useCallback((m: string) => {
    setToastMsg(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(""), 2400);
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await api<{ reservations: Reservation[] }>("/api/reservations");
      setRows(r.reservations);
      setSyncOk(true);
      setSyncedAt(new Date());
    } catch (e: any) {
      if (e.status === 401) { onLogout(); return; }
      setSyncOk(false);
      setSyncErr(e.message || "");
    }
  }, [onLogout]);

  useEffect(() => {
    load();
    const id = setInterval(() => { if (document.visibilityState === "visible") load(); }, POLL_MS);
    const vis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("online", vis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", vis); window.removeEventListener("online", vis); };
  }, [load]);

  useEffect(() => {
    setZoom(window.matchMedia("(max-width: 700px)").matches);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("locked", !!mode);
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setMode(null); };
    if (mode) document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [mode]);

  const byTable = useMemo(() => {
    const m = new Map<number, Reservation[]>();
    (rows || []).forEach((r) => { const a = m.get(r.table_no) || []; a.push(r); m.set(r.table_no, a); });
    return m;
  }, [rows]);
  const sold = (n: number) => (byTable.get(n) || []).reduce((s, r) => s + r.seats, 0);
  const paidSeats = (n: number) => (byTable.get(n) || []).reduce((s, r) => s + (r.paid ? r.seats : 0), 0);

  async function logout() {
    try { await api("/api/logout", { method: "POST" }); } catch {}
    onLogout();
  }

  function freeMessage() {
    const d = new Date(), p = (x: number) => String(x).padStart(2, "0");
    const when = `${p(d.getDate())}.${p(d.getMonth() + 1)}. u ${p(d.getHours())}:${p(d.getMinutes())}`;
    const parts = ZONE_KEYS.map((k) => {
      const z = ZONES[k];
      const ts = TABLES.filter((t) => t.zone === k && t.cap - sold(t.n) > 0);
      const head = `${z.name.toUpperCase()} (${z.price}€ po mestu)`;
      if (!ts.length) return `${head}\nRasprodato`;
      return head + "\n" + ts.map((t) => {
        const f = t.cap - sold(t.n);
        return `Sto ${t.n}: ${f} ${slobodnih(f)}${f === t.cap ? " (ceo sto)" : ""}`;
      }).join("\n");
    });
    return `Restoran Different, doček Nove 2027.\nSlobodna mesta, stanje ${when}:\n\n${parts.join("\n\n")}`;
  }

  async function copyFree() {
    await load();
    const text = freeMessage();
    if (await copyText(text)) toast("Poruka kopirana. Nalepite je u Viber, WhatsApp ili SMS.");
    else setMode({ kind: "copy", title: "Slobodna mesta", text });
  }

  const ql = q.trim().toLowerCase();
  // bez obzira na kvačice: "visnjin" nalazi "Višnjin"
  const fold = (x: string) => x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "dj");
  const qf = fold(q.trim());
  const hits = qf ? (rows || []).filter((r) => fold(r.name).includes(qf) || fold(r.source || "").includes(qf) || (r.phone || "").replace(/\s/g, "").includes(qf.replace(/\s/g, "")))
    .sort((a, b) => a.table_no - b.table_no) : [];

  return (
    <>
      <div className="page">
        <header className="top">
          <div>
            <h1>Restoran Different · <span>Nova Godina 2027</span></h1>
            <div className="sub">Evidencija prodaje mesta po stolovima · 31.12.</div>
          </div>
          <button className="logout" onClick={logout}>Odjava</button>
        </header>

        <div className="tools">
          <input className="field" type="search" placeholder="Pronađi gosta ili ko je poslao…" aria-label="Pretraga gostiju"
            value={q} onChange={(e) => setQ(e.target.value)} enterKeyHint="search" />
          <button className="btn" onClick={copyFree} disabled={!rows}>Kopiraj slobodna mesta</button>
          <button className="btn" onClick={() => setMode({ kind: "list" })} disabled={!rows}>Spisak gostiju</button>
        </div>

        {ql && (
          <section className="hits" aria-label="Rezultati pretrage">
            {hits.length ? hits.map((r) => {
              const t = TABLE_BY_NO.get(r.table_no);
              return (
                <button key={r.id} className="hit" onClick={() => setMode({ kind: "table", n: r.table_no })}>
                  <span className="hit-t">Sto {r.table_no}</span>
                  <span className="hit-n"><strong>{r.name}</strong>
                    <small>{r.seats} {mesta(r.seats)}{r.source ? " · " + r.source : ""}{t ? " · " + ZONES[t.zone].short : ""}</small></span>
                  <span className={"hit-s " + (r.paid ? "st-p" : "st-r")}>{r.paid ? "Plaćeno" : "Rezervisano"}</span>
                </button>
              );
            }) : <p className="empty">Nema gosta „{q.trim()}".</p>}
          </section>
        )}

        <Stats rows={rows} sold={sold} paidSeats={paidSeats} />

        <div className="legend">
          <span><b style={{ background: "var(--gold)" }} />Gold · 135€</span>
          <span><b style={{ background: "var(--silver)" }} />Silver · 120€</span>
          <span><b style={{ background: "var(--bronze)" }} />Bronze · 95€</span>
          <span><b style={{ background: "var(--surface-2)", border: "1.5px solid var(--gold)" }} />rezervisano</span>
          <span><b style={{ background: "var(--free)", border: "1px solid var(--line)" }} />slobodno</span>
        </div>

        <section className="mapcard" aria-label="Mapa stolova">
          <div className="maphead">
            <span className="hint">{zoom ? "Prevucite mapu levo-desno" : "Kliknite na sto za detalje"}</span>
            <div className="seg2" role="group" aria-label="Veličina mape">
              <button aria-pressed={!zoom} onClick={() => setZoom(false)}>Cela mapa</button>
              <button aria-pressed={zoom} onClick={() => setZoom(true)}>Uvećano</button>
            </div>
          </div>
          <div className={"mapscroll" + (zoom ? " zoom" : "")}>
            <FloorMap byTable={byTable} sold={sold} paidSeats={paidSeats} q={ql} hitTables={new Set(hits.map((h) => h.table_no))} onPick={(n) => setMode({ kind: "table", n })} />
          </div>
        </section>

        <div className="foot">
          <span><i className={"dot" + (syncOk ? "" : " bad")} />
            {syncOk
              ? `Zajednička evidencija · osveženo ${syncedAt ? syncedAt.toLocaleTimeString("sr-RS") : "…"}`
              : (syncErr || "Nema veze sa bazom. Proverite internet, pokušavam ponovo.")}
          </span>
          <span>Promene kolega se pojavljuju za nekoliko sekundi.</span>
        </div>
      </div>

      {mode && <div className="scrim" onClick={() => setMode(null)} />}
      {mode?.kind === "table" && (
        <TableSheet key={mode.n} table={TABLE_BY_NO.get(mode.n)!} list={byTable.get(mode.n) || []}
          onClose={() => setMode(null)} reload={load} toast={toast} onLogout={onLogout} />
      )}
      {mode?.kind === "list" && (
        <ListSheet rows={rows || []} byTable={byTable} onClose={() => setMode(null)} toast={toast}
          onFallback={(title, text) => setMode({ kind: "copy", title, text })} />
      )}
      {mode?.kind === "copy" && (
        <aside className="sheet" role="dialog" aria-modal="true" aria-labelledby="shTitle">
          <div className="sh-head">
            <div><h2 id="shTitle">{mode.title}</h2><span className="chip" style={{ color: "var(--gold)" }}>Za kopiranje</span></div>
            <button className="x" onClick={() => setMode(null)} aria-label="Zatvori">✕</button>
          </div>
          <div className="sh-body">
            <p className="empty">Automatsko kopiranje nije uspelo. Označite tekst i kopirajte ga ručno.</p>
            <textarea className="copybox" readOnly value={mode.text} onFocus={(e) => e.currentTarget.select()} autoFocus />
          </div>
        </aside>
      )}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </>
  );
}

/* ---------------- stats ---------------- */

function Stats({ rows, sold, paidSeats }: { rows: Reservation[] | null; sold: (n: number) => number; paidSeats: (n: number) => number }) {
  const per = ZONE_KEYS.map((k) => {
    const ts = TABLES.filter((t) => t.zone === k), price = ZONES[k].price;
    const cap = ts.reduce((s, t) => s + t.cap, 0);
    const s = ts.reduce((a, t) => a + sold(t.n), 0);
    const p = ts.reduce((a, t) => a + paidSeats(t.n), 0);
    return { k, cap, s, p, rev: s * price, revPaid: p * price };
  });
  const tot = per.reduce((a, z) => a + z.s, 0);
  const totPaid = per.reduce((a, z) => a + z.p, 0);
  const rev = per.reduce((a, z) => a + z.rev, 0);
  const revPaid = per.reduce((a, z) => a + z.revPaid, 0);
  const full = TABLES.filter((t) => sold(t.n) >= t.cap).length;
  const pct = (a: number, b: number) => `${(a / b) * 100}%`;
  return (
    <section className="stats" aria-label="Pregled prodaje" aria-busy={!rows}>
      <div className="stat total">
        <span className="lbl">Ukupno prodato</span>
        <span className="big">{rows ? tot : "–"} <small>/ {TOTAL_CAP} mesta</small></span>
        <div className="bar"><i style={{ width: pct(totPaid, TOTAL_CAP), background: "var(--ok)" }} /><i style={{ width: pct(tot - totPaid, TOTAL_CAP), background: "var(--warn)" }} /></div>
        <span className="meta">Slobodno <b>{TOTAL_CAP - tot}</b> · Punih stolova <b>{full}/36</b></span>
        <span className="meta">Naplaćeno <b className="st-p">{eur(revPaid)}</b> · Čeka uplatu <b className="st-r">{eur(rev - revPaid)}</b></span>
      </div>
      {per.map((z) => {
        const Z = ZONES[z.k as ZoneKey];
        return (
          <div className={`stat z-${z.k}`} key={z.k}>
            <span className="lbl">{Z.short} · {Z.price}€</span>
            <span className="big">{z.s} <small>/ {z.cap}</small></span>
            <div className="bar"><i style={{ width: pct(z.p, z.cap), background: Z.color }} /><i style={{ width: pct(z.s - z.p, z.cap), background: Z.color, opacity: .4 }} /></div>
            <span className="meta">Ostalo <b>{z.cap - z.s}</b></span>
            <span className="meta">{eur(z.rev)}</span>
          </div>
        );
      })}
    </section>
  );
}

/* ---------------- floor map ---------------- */

function FloorMap({ byTable, sold, paidSeats, q, hitTables, onPick }: {
  byTable: Map<number, Reservation[]>; sold: (n: number) => number; paidSeats: (n: number) => number; q: string; hitTables: Set<number>; onPick: (n: number) => void;
}) {
  const pillars: [number, number][] = [[179, 124], [627, 135], [174, 276], [633, 305], [158, 439], [637, 451]];
  return (
    <svg viewBox="0 0 1000 600" role="img" aria-label="Raspored stolova">
      <rect x={4} y={4} width={992} height={592} rx={6} fill="none" stroke="var(--gold)" strokeWidth={1.5} opacity={0.7} />
      <rect x={470} y={590} width={110} height={12} fill="var(--surface)" />
      <rect x={315} y={6} width={163} height={46} fill="var(--surface-2)" stroke="var(--gold)" />
      <text x={396} y={36} textAnchor="middle" fill="var(--fg)" fontFamily="var(--display)" fontSize={18} fontWeight={700} letterSpacing={2}>BINA</text>
      <text x={525} y={575} textAnchor="middle" fill="var(--muted)" fontFamily="var(--display)" fontSize={15} fontWeight={600} letterSpacing={2}>↑ ULAZ</text>
      {([[173, 407, 24, 140, "ŠVEDSKI STO 2"], [965, 470, 24, 98, "ŠVEDSKI"], [876, 543, 89, 24, "STO 1"]] as [number, number, number, number, string][]).map(([x, y, w, h, t]) => (
        <g key={t}>
          <rect x={x} y={y} width={w} height={h} fill="none" stroke="var(--muted)" />
          <text x={x + w / 2} y={y + h / 2} textAnchor="middle" dominantBaseline="middle" fill="var(--muted)" fontSize={10}
            fontFamily="var(--display)" letterSpacing={1} transform={h > w ? `rotate(-90 ${x + w / 2} ${y + h / 2})` : undefined}>{t}</text>
        </g>
      ))}
      {pillars.map(([x, y]) => <rect key={`${x}-${y}`} x={x - 11} y={y - 11} width={22} height={22} fill="var(--gold)" opacity={0.55} />)}
      {TABLES.map((t) => (
        <TableMark key={t.n} t={t} s={sold(t.n)} p={paidSeats(t.n)}
          state={q ? (hitTables.has(t.n) ? "hit" : "dim") : ""}
          onPick={onPick} />
      ))}
    </svg>
  );
}

function TableMark({ t, s, p, state, onPick }: { t: Table; s: number; p: number; state: string; onPick: (n: number) => void }) {
  const z = ZONES[t.zone], free = t.cap - s, full = free <= 0;
  const seats = [];
  for (let i = 0; i < t.cap; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / t.cap, cx = t.x + 33 * Math.cos(a), cy = t.y + 33 * Math.sin(a);
    if (i < p) seats.push(<circle key={i} cx={cx} cy={cy} r={5} fill={z.color} />);
    else if (i < s) seats.push(<circle key={i} cx={cx} cy={cy} r={4.3} fill="var(--surface-2)" stroke={z.color} strokeWidth={1.6} />);
    else seats.push(<circle key={i} cx={cx} cy={cy} r={5} fill="var(--free)" stroke="var(--line)" />);
  }
  return (
    <g className={"tbl " + state} tabIndex={0} role="button" aria-label={`Sto ${t.n}, ${z.name}, slobodno ${Math.max(free, 0)} od ${t.cap}`}
      onClick={() => onPick(t.n)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(t.n); } }}>
      <circle cx={t.x} cy={t.y} r={42} fill="transparent" />
      {seats}
      <circle className="disc" cx={t.x} cy={t.y} r={24} fill={full ? z.color : "var(--surface-2)"} stroke={z.color} strokeWidth={1.5} />
      <text x={t.x} y={t.y - 3} textAnchor="middle" fill={full ? "var(--on-gold)" : "var(--fg)"} fontFamily="var(--display)" fontSize={17} fontWeight={700}>{t.n}</text>
      <text x={t.x} y={t.y + 13} textAnchor="middle" fill={full ? "var(--on-gold)" : free <= 2 ? "var(--danger)" : "var(--muted)"}
        fontFamily="var(--display)" fontSize={11} fontWeight={600}>{full ? "PUN" : `${free}/${t.cap}`}</text>
    </g>
  );
}

/* ---------------- table sheet ---------------- */

function TableSheet({ table: t, list, onClose, reload, toast, onLogout }: {
  table: Table; list: Reservation[]; onClose: () => void; reload: () => Promise<void>; toast: (m: string) => void; onLogout: () => void;
}) {
  const z = ZONES[t.zone];
  const s = list.reduce((a, r) => a + r.seats, 0);
  const p = list.reduce((a, r) => a + (r.paid ? r.seats : 0), 0);
  const free = Math.max(t.cap - s, 0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("");
  const [qty, setQty] = useState(Math.min(2, Math.max(1, free)));
  const [paid, setPaid] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editSource, setEditSource] = useState("");
  const [editErr, setEditErr] = useState("");

  useEffect(() => { if (qty > free && free > 0) setQty(free); }, [free, qty]);

  function startEdit(r: Reservation) {
    setArmed(null); setEditErr("");
    setEditId(r.id); setEditName(r.name); setEditPhone(r.phone || ""); setEditSource(r.source || "");
  }

  async function saveEdit(e: FormEvent, r: Reservation) {
    e.preventDefault();
    const nm = editName.trim();
    if (!nm) { setEditErr("Ime ne može biti prazno."); return; }
    setPending(r.id); setEditErr("");
    try {
      const res: any = await api(`/api/reservations/${r.id}`, { method: "PATCH", body: JSON.stringify({ name: nm, phone: editPhone.trim(), source: editSource.trim() }) });
      setEditId(null);
      toast(res?.warning || "Izmena sačuvana");
    } catch (e: any) {
      if (e?.status === 401) { onLogout(); return; }
      setEditErr(e?.message || "Izmena nije sačuvana.");
    }
    await reload(); setPending(null);
  }

  function handle(e: any) {
    if (e?.status === 401) { onLogout(); return; }
    toast(e?.message || "Greška. Pokušajte ponovo.");
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    const nm = name.trim();
    if (!nm) { setErr("Upišite ime gosta ili grupe."); return; }
    if (qty > free) { setErr(`Za ovim stolom je ostalo samo ${free} mesta.`); return; }
    setBusy(true); setErr("");
    try {
      const res: any = await api("/api/reservations", { method: "POST", body: JSON.stringify({ table_no: t.n, name: nm, phone: phone.trim(), source: source.trim(), seats: qty, paid }) });
      setName(""); setPhone(""); setSource(""); setPaid(false); setQty(1);
      toast(res?.warning || `Upisano: ${nm}, sto ${t.n}`);
    } catch (e: any) {
      if (e.status === 401) { onLogout(); return; }
      setErr(e.message);
    } finally {
      await reload();
      setBusy(false);
    }
  }

  async function togglePaid(r: Reservation) {
    setPending(r.id);
    try {
      await api(`/api/reservations/${r.id}`, { method: "PATCH", body: JSON.stringify({ paid: !r.paid }) });
      toast(!r.paid ? `${r.name}: plaćeno` : `${r.name}: vraćeno na rezervisano`);
    } catch (e) { handle(e); }
    await reload(); setPending(null);
  }

  async function del(r: Reservation) {
    if (armed !== r.id) { setArmed(r.id); return; }
    setArmed(null); setPending(r.id);
    try { await api(`/api/reservations/${r.id}`, { method: "DELETE" }); toast("Obrisano"); }
    catch (e) { handle(e); }
    await reload(); setPending(null);
  }

  const ordered = [...list].sort((a, b) => Number(b.paid) - Number(a.paid));
  return (
    <aside className="sheet" role="dialog" aria-modal="true" aria-labelledby="shTitle">
      <div className="sh-head">
        <div><h2 id="shTitle">Sto {t.n}</h2><span className="chip" style={{ color: z.color }}>{z.name} · {z.price}€ po mestu</span></div>
        <button className="x" onClick={onClose} aria-label="Zatvori">✕</button>
      </div>
      <div className="sh-body">
        <div className="kv">
          <div><span>Prodato</span><strong>{s}</strong></div>
          <div><span>Slobodno</span><strong style={{ color: free ? "var(--fg)" : "var(--danger)" }}>{free}</strong></div>
          <div><span>Iznos</span><strong>{eur(s * z.price)}</strong></div>
        </div>
        <p className="money">Naplaćeno <b className="st-p">{eur(p * z.price)}</b> · Čeka uplatu <b className="st-r">{eur((s - p) * z.price)}</b></p>
        <div className="seats" aria-label={`${s} od ${t.cap} stolica prodato`}>
          {ordered.flatMap((r) => Array.from({ length: r.seats }, (_, i) => (
            <i key={r.id + i} title={r.name} style={r.paid ? { background: z.color, borderColor: z.color } : { background: "var(--surface-2)", borderColor: z.color }} />
          )))}
          {Array.from({ length: free }, (_, i) => <i key={"f" + i} />)}
        </div>

        <p className="sec-t">Gosti za ovim stolom</p>
        {list.length ? (
          <ul className="res">
            {list.map((r) => editId === r.id ? (
              <li key={r.id} className="editing">
                <form className="edit" onSubmit={(e) => saveEdit(e, r)} noValidate>
                  <label className="sec-t" htmlFor={"en-" + r.id}>Ime gosta ili grupe</label>
                  <input id={"en-" + r.id} className="field" type="text" value={editName} maxLength={120} autoFocus
                    autoComplete="off" onChange={(e) => setEditName(e.target.value)} />
                  <label className="sec-t" htmlFor={"ep-" + r.id}>Telefon</label>
                  <input id={"ep-" + r.id} className="field" type="tel" value={editPhone} maxLength={40}
                    autoComplete="off" placeholder="nije obavezno" onChange={(e) => setEditPhone(e.target.value)} />
                  <label className="sec-t" htmlFor={"es-" + r.id}>Ko je poslao</label>
                  <input id={"es-" + r.id} className="field" type="text" value={editSource} maxLength={80}
                    autoComplete="off" placeholder="nije obavezno" onChange={(e) => setEditSource(e.target.value)} />
                  {editErr && <p className="err">{editErr}</p>}
                  <div className="edit-btns">
                    <button type="button" className="ghost" onClick={() => setEditId(null)} disabled={pending === r.id}>Otkaži</button>
                    <button type="submit" className="primary" disabled={pending === r.id}>{pending === r.id ? "Čuvam…" : "Sačuvaj"}</button>
                  </div>
                </form>
              </li>
            ) : (
              <li key={r.id}>
                <div className="n"><strong>{r.name}</strong><small>{r.phone ? r.phone + " · " : ""}{eur(r.seats * z.price)}</small>{r.source ? <small className="src">Poslao: {r.source}</small> : null}</div>
                <span className="cnt">{r.seats}<em>{mesta(r.seats)}</em></span>
                <div className="acts">
                  <button className={"pill " + (r.paid ? "paid" : "resv")} onClick={() => togglePaid(r)} disabled={pending === r.id}>
                    {r.paid ? "Plaćeno ✓" : "Rezervisano"}
                  </button>
                  <button className="del" onClick={() => startEdit(r)} disabled={pending === r.id}>Izmeni</button>
                  <button className={"del" + (armed === r.id ? " arm" : "")} onClick={() => del(r)} disabled={pending === r.id}>
                    {armed === r.id ? "Potvrdi" : "Obriši"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : <p className="empty">Još niko nije upisan za ovaj sto.</p>}

        {free > 0 ? (
          <form className="add" onSubmit={add} noValidate>
            <p className="sec-t">Dodaj prodaju</p>
            <input className="field" id="fName" type="text" placeholder="Ime i prezime ili naziv grupe" autoComplete="off"
              value={name} onChange={(e) => setName(e.target.value)} maxLength={120} enterKeyHint="next" />
            <input className="field" id="fPhone" type="tel" placeholder="Telefon (nije obavezno)" autoComplete="off"
              value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} />
            <input className="field" id="fSource" type="text" placeholder="Ko je poslao (nije obavezno)" autoComplete="off"
              value={source} onChange={(e) => setSource(e.target.value)} maxLength={80} />
            <div className="row">
              <div className="step">
                <button type="button" onClick={() => setQty((v) => Math.max(1, v - 1))} aria-label="Manje">−</button>
                <output aria-live="polite">{qty}</output>
                <button type="button" onClick={() => setQty((v) => Math.min(free, v + 1))} aria-label="Više">+</button>
              </div>
              <div className="seg" role="group" aria-label="Status">
                <button type="button" aria-pressed={!paid} onClick={() => setPaid(false)}>Rezervisano</button>
                <button type="button" aria-pressed={paid} onClick={() => setPaid(true)}>Plaćeno</button>
              </div>
            </div>
            <button className="primary" type="submit" disabled={busy}>
              {busy ? "Upisujem…" : `Dodaj ${qty} ${mesta(qty)} · ${eur(qty * z.price)}`}
            </button>
            {err && <p className="err">{err}</p>}
          </form>
        ) : <p className="empty" style={{ color: "var(--danger)" }}>Sto je pun.</p>}
      </div>
    </aside>
  );
}

/* ---------------- guest list ---------------- */

type Filter = "all" | "paid" | "res";

function ListSheet({ rows, byTable, onClose, toast, onFallback }: {
  rows: Reservation[]; byTable: Map<number, Reservation[]>; onClose: () => void; toast: (m: string) => void; onFallback: (t: string, x: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const keep = (r: Reservation) => filter === "all" || (filter === "paid" ? r.paid : !r.paid);
  const groups = TABLES.map((t) => ({ t, list: (byTable.get(t.n) || []).filter(keep) })).filter((g) => g.list.length);
  const flat = groups.flatMap((g) => g.list.map((r) => ({ t: g.t, r })));
  const seats = flat.reduce((a, x) => a + x.r.seats, 0);
  const sum = flat.reduce((a, x) => a + x.r.seats * ZONES[x.t.zone].price, 0);

  function table(sep: string) {
    const q = (v: unknown) => { const s = String(v ?? ""); return /[";,\n\t]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = [["Sto", "Zona", "Gost", "Mesta", "Telefon", "Ko je poslao", "Status", "Cena po mestu", "Iznos"].join(sep)];
    flat.forEach(({ t, r }) => {
      const z = ZONES[t.zone];
      lines.push([t.n, z.short, r.name, r.seats, r.phone, r.source || "", r.paid ? "Plaćeno" : "Rezervisano", z.price, r.seats * z.price].map(q).join(sep));
    });
    return lines.join(sep === "\t" ? "\n" : "\r\n");
  }

  function download() {
    const suffix = filter === "paid" ? "-placeni" : filter === "res" ? "-rezervisani" : "";
    const blob = new Blob(["﻿" + table(";")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `different-nova-godina-gosti${suffix}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast("Spisak preuzet");
  }

  async function copy() {
    const text = table("\t");
    if (await copyText(text)) toast("Kopirano. Nalepite u Excel ili Google Sheets.");
    else onFallback("Spisak gostiju", text);
  }

  // "Zmijica" za WhatsApp: zona po zona, svaki sto u svom redu
  function snake() {
    return ZONE_KEYS.map((k) => {
      const z = ZONES[k];
      const lines = TABLES.filter((t) => t.zone === k).map((t) => {
        // uvek svi gosti; plaćeni su podebljani (*tekst* je bold u WhatsAppu)
        const L = byTable.get(t.n) || [];
        const names = L.map((r) => {
          const who = `${r.name.replace(/\*/g, "")} ${r.seats}${r.source ? ` (${r.source.replace(/\*/g, "")})` : ""}`;
          return r.paid ? `*${who}*` : who;
        }).join(", ");
        // u zagradi koliko je još slobodnih mesta za stolom
        const free = Math.max(t.cap - L.reduce((a, r) => a + r.seats, 0), 0);
        return `${t.n}. ${names ? names + " " : ""}(${free}lj)`;
      });
      return `${z.short.toUpperCase()} ZONE (${z.price}e)\n${lines.join("\n")}`;
    }).join("\n\n");
  }

  async function copySnake() {
    const text = snake();
    if (await copyText(text)) toast("Kopirano. Nalepite u WhatsApp grupu.");
    else onFallback("Spisak za WhatsApp", text);
  }

  return (
    <aside className="sheet wide" role="dialog" aria-modal="true" aria-labelledby="shTitle">
      <div className="sh-head">
        <div><h2 id="shTitle">Spisak gostiju</h2><span className="chip" style={{ color: "var(--gold)" }}>Po stolovima</span></div>
        <button className="x" onClick={onClose} aria-label="Zatvori">✕</button>
      </div>
      <div className="sh-body">
        <div className="lt-tools">
          <select className="field" value={filter} onChange={(e) => setFilter(e.target.value as Filter)} aria-label="Prikaži">
            <option value="all">Svi gosti</option>
            <option value="paid">Samo plaćeni</option>
            <option value="res">Samo rezervisani (neplaćeni)</option>
          </select>
          <button className="primary" onClick={copySnake}>Kopiraj za WhatsApp</button>
          <div className="btns">
            <button className="ghost" onClick={download} disabled={!flat.length}>Preuzmi za Excel</button>
            <button className="ghost" onClick={copy} disabled={!flat.length}>Kopiraj za Excel</button>
          </div>
        </div>
        <div className="tot"><span>Gostiju/grupa <b>{flat.length}</b></span><span>Mesta <b>{seats}</b></span><span>Iznos <b>{eur(sum)}</b></span></div>
        {groups.length ? (
          <div className="glist">
            {groups.map(({ t, list }) => {
              const z = ZONES[t.zone];
              const sub = list.reduce((a, r) => a + r.seats, 0);
              return (
                <div key={t.n}>
                  <div className="ghead">Sto {t.n}<span>{z.short} · {sub}/{t.cap} mesta</span></div>
                  {list.map((r) => (
                    <div className="grow" key={r.id}>
                      <div className="gm">
                        <strong>{r.name}</strong>
                        <small>{r.phone ? r.phone + " · " : ""}{r.source ? "Poslao: " + r.source + " · " : ""}<span className={r.paid ? "st-p" : "st-r"}>{r.paid ? "Plaćeno" : "Rezervisano"}</span></small>
                      </div>
                      <div className="gr"><b>{r.seats}</b> {mesta(r.seats)}<br />{eur(r.seats * z.price)}</div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ) : <p className="empty">{rows.length ? "Nema gostiju za ovaj prikaz." : "Još nema upisanih gostiju."}</p>}
      </div>
    </aside>
  );
}
