export type ZoneKey = "gold" | "silver" | "bronze";

export const ZONES: Record<ZoneKey, { name: string; short: string; price: number; color: string }> = {
  gold: { name: "Gold zona", short: "Gold", price: 135, color: "var(--gold)" },
  silver: { name: "Silver zona", short: "Silver", price: 120, color: "var(--silver)" },
  bronze: { name: "Bronze zona", short: "Bronze", price: 95, color: "var(--bronze)" }
};
export const ZONE_KEYS: ZoneKey[] = ["gold", "silver", "bronze"];

export type Table = { n: number; x: number; y: number; cap: number; zone: ZoneKey };

// [broj, x, y, mesta] — koordinate prema mapi sa plakata (mapa 1000 x 600)
const RAW: [number, number, number, number][] = [
  [1, 178, 53, 12], [2, 233, 148, 10], [3, 153, 193, 12], [4, 228, 297, 10], [5, 311, 218, 10],
  [6, 376, 132, 10], [7, 376, 301, 10], [8, 433, 218, 10], [9, 524, 132, 10], [10, 585, 227, 10],
  [11, 532, 306, 10], [12, 609, 60, 12], [13, 725, 60, 12],
  [14, 67, 48, 12], [15, 70, 140, 12], [16, 70, 255, 12], [17, 318, 413, 12], [18, 446, 413, 12],
  [19, 618, 385, 10], [20, 738, 350, 12], [21, 730, 256, 12], [22, 727, 155, 12], [23, 824, 60, 12],
  [24, 833, 155, 12], [25, 831, 255, 12],
  [26, 319, 522, 12], [27, 447, 522, 12], [28, 738, 518, 10], [29, 738, 430, 12], [30, 836, 425, 12],
  [31, 833, 343, 12], [32, 933, 425, 12], [33, 933, 343, 12], [34, 933, 255, 12], [35, 928, 150, 12],
  [36, 930, 60, 12]
];

export const TABLES: Table[] = RAW.map(([n, x, y, cap]) => ({
  n, x, y, cap,
  zone: n <= 13 ? "gold" : n <= 25 ? "silver" : "bronze"
}));

export const TABLE_BY_NO = new Map(TABLES.map((t) => [t.n, t]));
export const TOTAL_CAP = TABLES.reduce((s, t) => s + t.cap, 0);

export type Reservation = {
  id: string;
  table_no: number;
  name: string;
  phone: string;
  source?: string;
  seats: number;
  paid: boolean;
  deposit?: boolean;
  created_at: string;
};

export type Status = "paid" | "deposit" | "res";
export const statusOf = (r: Reservation): Status => (r.paid ? "paid" : r.deposit ? "deposit" : "res");
export const STATUS_LABEL: Record<Status, string> = { paid: "Plaćeno", deposit: "Kaparisano", res: "Rezervisano" };
export const STATUS_CLASS: Record<Status, string> = { paid: "st-p", deposit: "st-d", res: "st-r" };
