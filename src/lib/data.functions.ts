import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SYMBOL = z.string().min(1).max(12).regex(/^[A-Za-z0-9.\-^]+$/).transform((s) => s.toUpperCase());

// ---- Watchlist ----
export const listWatchlist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("watchlist")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const addWatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { symbol: string; note?: string }) =>
    z.object({ symbol: SYMBOL, note: z.string().max(200).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("watchlist")
      .insert({ user_id: context.userId, symbol: data.symbol, note: data.note ?? null });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeWatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("watchlist").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- Portfolio ----
export const listPortfolio = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("portfolio")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const addHolding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { symbol: string; shares: number; avg_cost: number }) =>
    z
      .object({ symbol: SYMBOL, shares: z.number().positive(), avg_cost: z.number().min(0) })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("portfolio").insert({
      user_id: context.userId,
      symbol: data.symbol,
      shares: data.shares,
      avg_cost: data.avg_cost,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeHolding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("portfolio").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- Alerts ----
export const listAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("price_alerts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const addAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { symbol: string; target_price: number; direction: "above" | "below" }) =>
    z
      .object({
        symbol: SYMBOL,
        target_price: z.number().positive(),
        direction: z.enum(["above", "below"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("price_alerts").insert({
      user_id: context.userId,
      symbol: data.symbol,
      target_price: data.target_price,
      direction: data.direction,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("price_alerts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- Analyses ----
export const saveAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { symbol: string; question?: string; result: unknown }) =>
    z
      .object({
        symbol: SYMBOL,
        question: z.string().max(500).optional(),
        result: z.any(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("analyses").insert({
      user_id: context.userId,
      symbol: data.symbol,
      question: data.question ?? null,
      result: data.result as never,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAnalyses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("analyses")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
