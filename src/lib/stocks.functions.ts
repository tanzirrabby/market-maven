import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SYMBOL = z.string().min(1).max(16).regex(/^[A-Za-z0-9.\-^=]+$/);
const UA = "Mozilla/5.0 (compatible; QuantumTradeBot/1.0)";

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

type YahooChart = {
  chart: {
    result?: Array<{
      meta: {
        symbol: string;
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
        regularMarketTime?: number;
        regularMarketDayHigh?: number;
        regularMarketDayLow?: number;
        regularMarketVolume?: number;
        gmtoffset?: number;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: (number | null)[];
          high?: (number | null)[];
          low?: (number | null)[];
          close?: (number | null)[];
          volume?: (number | null)[];
        }>;
      };
    }>;
    error?: { code: string; description: string } | null;
  };
};

type ChartResult = NonNullable<YahooChart["chart"]["result"]>[number];

// ---------- In-memory TTL cache (per-isolate) ----------
type CacheEntry<T> = { value: T; expires: number };
const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_MAX = 500;

function cacheGet<T>(key: string): T | undefined {
  const e = cache.get(key);
  if (!e) return undefined;
  if (e.expires < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return e.value as T;
}
function cacheSet<T>(key: string, value: T, ttlMs: number) {
  if (cache.size >= CACHE_MAX) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
  cache.set(key, { value, expires: Date.now() + ttlMs });
}

// ---------- In-flight de-duplication ----------
const inflight = new Map<string, Promise<unknown>>();
function dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const p = fn().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

// ---------- Token-bucket rate limiter for outbound Yahoo calls ----------
const RATE_CAPACITY = 30; // burst
const RATE_REFILL_PER_SEC = 5; // sustained req/s
let tokens = RATE_CAPACITY;
let lastRefill = Date.now();
async function takeToken() {
  for (let i = 0; i < 50; i++) {
    const now = Date.now();
    const elapsed = (now - lastRefill) / 1000;
    tokens = Math.min(RATE_CAPACITY, tokens + elapsed * RATE_REFILL_PER_SEC);
    lastRefill = now;
    if (tokens >= 1) {
      tokens -= 1;
      return;
    }
    const waitMs = Math.ceil(((1 - tokens) / RATE_REFILL_PER_SEC) * 1000);
    await new Promise((r) => setTimeout(r, Math.min(waitMs, 500)));
  }
  throw new Error("Rate limit: upstream temporarily throttled");
}

async function fetchChart(symbol: string, range: string, interval: string): Promise<ChartResult | null> {
  const key = `chart:${symbol}:${range}:${interval}`;
  const cached = cacheGet<ChartResult>(key);
  if (cached) return cached;

  return dedupe(key, async () => {
    const again = cacheGet<ChartResult>(key);
    if (again) return again;

    await takeToken();
    const hosts = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];
    for (const host of hosts) {
      const url = `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
      try {
        const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
        if (!res.ok) continue;
        const json = (await res.json()) as YahooChart;
        const result = json.chart?.result?.[0];
        if (result) {
          // Quotes (intraday-ish) cache 60s; daily/weekly/monthly history cache 10min
          const ttl = interval === "1d" && range === "5d" ? 60_000 : 10 * 60_000;
          cacheSet(key, result, ttl);
          return result;
        }
      } catch {
        /* try next host */
      }
    }
    return null;
  });
}

function quoteFromChart(symbol: string, r: NonNullable<YahooChart["chart"]["result"]>[number]): Quote | null {
  const meta = r.meta;
  const close = meta.regularMarketPrice;
  const prev = meta.chartPreviousClose ?? meta.previousClose;
  if (typeof close !== "number" || typeof prev !== "number") return null;
  const ts = meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000) : new Date();
  const iso = ts.toISOString();
  return {
    symbol: (meta.symbol ?? symbol).toUpperCase(),
    date: iso.slice(0, 10),
    time: iso.slice(11, 19),
    open: prev,
    high: meta.regularMarketDayHigh ?? close,
    low: meta.regularMarketDayLow ?? close,
    close,
    volume: meta.regularMarketVolume ?? 0,
    change: +(close - prev).toFixed(4),
    changePct: prev ? +(((close - prev) / prev) * 100).toFixed(2) : 0,
  };
}

export const getQuote = createServerFn({ method: "POST" })
  .inputValidator((d: { symbol: string }) => ({ symbol: SYMBOL.parse(d.symbol) }))
  .handler(async ({ data }): Promise<Quote | null> => {
    const r = await fetchChart(data.symbol, "5d", "1d");
    if (!r) return null;
    return quoteFromChart(data.symbol, r);
  });

export const getQuotes = createServerFn({ method: "POST" })
  .inputValidator((d: { symbols: string[] }) => ({
    symbols: z.array(SYMBOL).max(50).parse(d.symbols),
  }))
  .handler(async ({ data }): Promise<Quote[]> => {
    const results = await Promise.allSettled(
      data.symbols.map(async (symbol) => {
        const r = await fetchChart(symbol, "5d", "1d");
        return r ? quoteFromChart(symbol, r) : null;
      }),
    );
    return results
      .map((r) => (r.status === "fulfilled" ? r.value : null))
      .filter((q): q is Quote => q !== null);
  });

export const getHistory = createServerFn({ method: "POST" })
  .inputValidator((d: { symbol: string; interval?: "d" | "w" | "m" }) => ({
    symbol: SYMBOL.parse(d.symbol),
    interval: (d.interval ?? "d") as "d" | "w" | "m",
  }))
  .handler(async ({ data }) => {
    const intervalMap = { d: "1d", w: "1wk", m: "1mo" } as const;
    const r = await fetchChart(data.symbol, "1y", intervalMap[data.interval]);
    if (!r || !r.timestamp) return [];
    const q = r.indicators?.quote?.[0];
    const rows = r.timestamp
      .map((t, i) => ({
        date: new Date(t * 1000).toISOString().slice(0, 10),
        open: Number(q?.open?.[i] ?? NaN),
        high: Number(q?.high?.[i] ?? NaN),
        low: Number(q?.low?.[i] ?? NaN),
        close: Number(q?.close?.[i] ?? NaN),
        volume: Number(q?.volume?.[i] ?? 0),
      }))
      .filter((r) => Number.isFinite(r.close));
    return rows;
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
    const cacheKey = `wb:${data.country}`;
    const cached = cacheGet<{ country: string; indicators: Record<string, { year: number; value: number | null }[]> }>(cacheKey);
    if (cached) return cached;

    return dedupe(cacheKey, async () => {
      const out: Record<string, { year: number; value: number | null }[]> = {};
      await Promise.all(
        Object.entries(INDICATORS).map(async ([key, code]) => {
          await takeToken();
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
      const result = { country: data.country, indicators: out };
      // World Bank data updates infrequently — cache 6 hours
      cacheSet(cacheKey, result, 6 * 60 * 60_000);
      return result;
    });
  });
