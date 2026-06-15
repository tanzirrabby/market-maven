import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { getQuotes } from "@/lib/stocks.functions";
import { addWatch, listWatchlist, removeWatch } from "@/lib/data.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const DEFAULTS = ["AAPL", "MSFT", "NVDA", "TSLA", "GOOGL", "AMZN"];

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · QuantumTrade" }] }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const listFn = useServerFn(listWatchlist);
  const quotesFn = useServerFn(getQuotes);
  const addFn = useServerFn(addWatch);
  const rmFn = useServerFn(removeWatch);

  const watch = useQuery({ queryKey: ["watchlist"], queryFn: () => listFn() });
  const symbols = [...new Set([...(watch.data?.map((w) => w.symbol) ?? []), ...DEFAULTS])];
  const quotes = useQuery({
    queryKey: ["quotes", symbols.join(",")],
    queryFn: () => quotesFn({ data: { symbols } }),
    enabled: symbols.length > 0,
    refetchInterval: 60_000,
  });

  const addMut = useMutation({
    mutationFn: (symbol: string) => addFn({ data: { symbol } }),
    onSuccess: () => {
      toast.success("Added to watchlist");
      qc.invalidateQueries({ queryKey: ["watchlist"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const rmMut = useMutation({
    mutationFn: (id: string) => rmFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist"] }),
  });

  function go(e: React.FormEvent) {
    e.preventDefault();
    const sym = q.trim().toUpperCase();
    if (!sym) return;
    navigate({ to: "/stock/$symbol", params: { symbol: sym } });
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Market Terminal</h1>
          <p className="text-sm text-muted-foreground">Search any symbol, watch live moves, ask the AI bench.</p>
        </div>
        <form onSubmit={go} className="flex w-full max-w-md gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search ticker (e.g. AAPL, MSFT, ^SPX)"
              className="pl-9"
            />
          </div>
          <Button type="submit">Analyze</Button>
        </form>
      </section>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Live tape</CardTitle>
        </CardHeader>
        <CardContent>
          {quotes.isLoading ? (
            <div className="h-32 animate-pulse rounded bg-secondary/40" />
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {(quotes.data ?? []).map((qt) => {
                const up = qt.changePct >= 0;
                const isWatched = watch.data?.find((w) => w.symbol === qt.symbol);
                return (
                  <Link
                    key={qt.symbol}
                    to="/stock/$symbol"
                    params={{ symbol: qt.symbol }}
                    className="group rounded-lg border bg-card/60 p-4 transition hover:border-primary/50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{qt.symbol}</span>
                      <Badge variant="outline" className={up ? "border-bull/40 text-bull" : "border-bear/40 text-bear"}>
                        {up ? <TrendingUp className="mr-1 h-3 w-3" /> : <TrendingDown className="mr-1 h-3 w-3" />}
                        {up ? "+" : ""}{qt.changePct}%
                      </Badge>
                    </div>
                    <div className="mt-2 num text-2xl font-bold">{qt.close.toFixed(2)}</div>
                    <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{qt.date}</span>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          if (isWatched) rmMut.mutate(isWatched.id);
                          else addMut.mutate(qt.symbol);
                        }}
                        className="opacity-0 transition group-hover:opacity-100 hover:text-primary"
                      >
                        {isWatched ? "Unwatch" : "Watch"}
                      </button>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
