import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { addHolding, listPortfolio, removeHolding } from "@/lib/data.functions";
import { getQuotes } from "@/lib/stocks.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/portfolio")({
  head: () => ({ meta: [{ title: "Portfolio · QuantumTrade" }] }),
  component: PortfolioPage,
});

function PortfolioPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listPortfolio);
  const addFn = useServerFn(addHolding);
  const rmFn = useServerFn(removeHolding);
  const quotesFn = useServerFn(getQuotes);

  const [sym, setSym] = useState("");
  const [shares, setShares] = useState("");
  const [cost, setCost] = useState("");

  const list = useQuery({ queryKey: ["portfolio"], queryFn: () => listFn() });
  const symbols = [...new Set(list.data?.map((h) => h.symbol) ?? [])];
  const quotes = useQuery({
    queryKey: ["quotes", symbols.join(",")],
    queryFn: () => quotesFn({ data: { symbols } }),
    enabled: symbols.length > 0,
  });
  const byS = Object.fromEntries((quotes.data ?? []).map((q) => [q.symbol, q]));

  const add = useMutation({
    mutationFn: () =>
      addFn({ data: { symbol: sym.toUpperCase(), shares: Number(shares), avg_cost: Number(cost) } }),
    onSuccess: () => {
      setSym(""); setShares(""); setCost("");
      qc.invalidateQueries({ queryKey: ["portfolio"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const rm = useMutation({
    mutationFn: (id: string) => rmFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portfolio"] }),
  });

  const totals = (list.data ?? []).reduce(
    (acc, h) => {
      const price = byS[h.symbol]?.close ?? Number(h.avg_cost);
      const cost = Number(h.shares) * Number(h.avg_cost);
      const value = Number(h.shares) * price;
      acc.cost += cost; acc.value += value;
      return acc;
    },
    { cost: 0, value: 0 },
  );
  const pnl = totals.value - totals.cost;
  const pnlPct = totals.cost ? (pnl / totals.cost) * 100 : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Portfolio</h1>

      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Market value" value={`$${totals.value.toFixed(2)}`} />
        <Stat label="Cost basis" value={`$${totals.cost.toFixed(2)}`} />
        <Stat
          label="Unrealized P/L"
          value={`${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)} (${pnlPct.toFixed(2)}%)`}
          tone={pnl >= 0 ? "bull" : "bear"}
        />
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Add holding</CardTitle></CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-4">
          <Input placeholder="Symbol" value={sym} onChange={(e) => setSym(e.target.value)} />
          <Input placeholder="Shares" inputMode="decimal" value={shares} onChange={(e) => setShares(e.target.value)} />
          <Input placeholder="Avg cost" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />
          <Button onClick={() => add.mutate()} disabled={!sym || !shares || !cost || add.isPending}>Add</Button>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {list.data?.length === 0 && <div className="text-sm text-muted-foreground">No holdings yet.</div>}
        {list.data?.map((h) => {
          const price = byS[h.symbol]?.close ?? Number(h.avg_cost);
          const value = Number(h.shares) * price;
          const cost = Number(h.shares) * Number(h.avg_cost);
          const p = value - cost;
          const pct = cost ? (p / cost) * 100 : 0;
          return (
            <div key={h.id} className="grid grid-cols-2 items-center gap-3 rounded-lg border bg-card/60 p-4 md:grid-cols-6">
              <div className="font-semibold">{h.symbol}</div>
              <div className="num text-sm text-muted-foreground">{h.shares} sh</div>
              <div className="num text-sm text-muted-foreground">@ ${Number(h.avg_cost).toFixed(2)}</div>
              <div className="num">${price.toFixed(2)}</div>
              <Badge variant="outline" className={p >= 0 ? "border-bull/40 text-bull w-fit" : "border-bear/40 text-bear w-fit"}>
                {p >= 0 ? "+" : ""}${p.toFixed(2)} ({pct.toFixed(2)}%)
              </Badge>
              <div className="text-right">
                <Button size="icon" variant="ghost" onClick={() => rm.mutate(h.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "bull" | "bear" }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={`num mt-1 text-2xl font-bold ${tone === "bull" ? "text-bull" : tone === "bear" ? "text-bear" : ""}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
