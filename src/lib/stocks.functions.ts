import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SYMBOL = z.string().min(1).max(12).regex(/^[A-Za-z0-9.\-^]+$/);

function stooqSymbol(s: string) {
  const sym = s.trim().toLowerCase();
  return sym.includes(".") ? sym : `${sym}.us`;
}

export type Quote = {
  symbol: string;
  date: string;
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change: number;
  changePct: number;
};

export const getQuote = createServerFn({ method: "POST" })
  .inputValidator((d: { symbol: string }) => ({ symbol: SYMBOL.parse(d.symbol) }))
  .handler(async ({ data }): Promise<Quote | null> => {
    const sym = stooqSymbol(data.symbol);
    const url = `https://stooq.com/q/l/?s=${sym}&f=sd2t2ohlcv&h&e=csv`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Quote fetch failed: ${res.status}`);
    const text = await res.text();
    const lines = text.trim().split("\n");
    if (lines.length < 2) return null;
    const row = lines[1].split(",");
    if (row[0] === "N/D" || row.length < 8) return null;
    const open = Number(row[3]);
    const close = Number(row[6]);
    return {
      symbol: row[0].toUpperCase(),
      date: row[1],
      time: row[2],
      open,
      high: Number(row[4]),
      low: Number(row[5]),
      close,
      volume: Number(row[7]),
      change: +(close - open).toFixed(4),
      changePct: open ? +(((close - open) / open) * 100).toFixed(2) : 0,
    };
  });

export const getHistory = createServerFn({ method: "POST" })
  .inputValidator((d: { symbol: string; interval?: "d" | "w" | "m" }) => ({
    symbol: SYMBOL.parse(d.symbol),
    interval: (d.interval ?? "d") as "d" | "w" | "m",
  }))
  .handler(async ({ data }) => {
    const sym = stooqSymbol(data.symbol);
    const url = `https://stooq.com/q/d/l/?s=${sym}&i=${data.interval}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`History fetch failed: ${res.status}`);
    const text = await res.text();
    const lines = text.trim().split("\n").slice(1);
    const rows = lines
      .map((line) => {
        const [date, open, high, low, close, volume] = line.split(",");
        return {
          date,
          open: Number(open),
          high: Number(high),
          low: Number(low),
          close: Number(close),
          volume: Number(volume),
        };
      })
      .filter((r) => Number.isFinite(r.close));
    return rows.slice(-260); // ~1y daily
  });

export const getQuotes = createServerFn({ method: "POST" })
  .inputValidator((d: { symbols: string[] }) => ({
    symbols: z.array(SYMBOL).max(50).parse(d.symbols),
  }))
  .handler(async ({ data }): Promise<Quote[]> => {
    const results = await Promise.allSettled(
      data.symbols.map(async (symbol) => {
        const sym = stooqSymbol(symbol);
        const url = `https://stooq.com/q/l/?s=${sym}&f=sd2t2ohlcv&h&e=csv`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const text = await res.text();
        const lines = text.trim().split("\n");
        if (lines.length < 2) return null;
        const row = lines[1].split(",");
        if (row[0] === "N/D" || row.length < 8) return null;
        const open = Number(row[3]);
        const close = Number(row[6]);
        return {
          symbol: row[0].toUpperCase(),
          date: row[1],
          time: row[2],
          open,
          high: Number(row[4]),
          low: Number(row[5]),
          close,
          volume: Number(row[7]),
          change: +(close - open).toFixed(4),
          changePct: open ? +(((close - open) / open) * 100).toFixed(2) : 0,
        } as Quote;
      }),
    );
    return results
      .map((r) => (r.status === "fulfilled" ? r.value : null))
      .filter((q): q is Quote => q !== null);
  });

// World Bank macro indicators
const INDICATORS: Record<string, string> = {
  gdp_growth: "NY.GDP.MKTP.KD.ZG",
  inflation: "FP.CPI.TOTL.ZG",
  unemployment: "SL.UEM.TOTL.ZS",
  interest_rate: "FR.INR.RINR",
};

export const getWorldBank = createServerFn({ method: "POST" })
  .inputValidator((d: { country?: string }) => ({
    country: (d.country ?? "USA").toUpperCase().slice(0, 3),
  }))
  .handler(async ({ data }) => {
    const out: Record<string, { year: number; value: number | null }[]> = {};
    await Promise.all(
      Object.entries(INDICATORS).map(async ([key, code]) => {
        const url = `https://api.worldbank.org/v2/country/${data.country}/indicator/${code}?format=json&per_page=10`;
        try {
          const res = await fetch(url);
          if (!res.ok) {
            out[key] = [];
            return;
          }
          const json = (await res.json()) as unknown;
          const series = Array.isArray(json) && Array.isArray(json[1]) ? json[1] : [];
          out[key] = series
            .map((r: { date: string; value: number | null }) => ({
              year: Number(r.date),
              value: r.value,
            }))
            .filter((r) => r.value !== null)
            .slice(0, 6)
            .reverse();
        } catch {
          out[key] = [];
        }
      }),
    );
    return { country: data.country, indicators: out };
  });
