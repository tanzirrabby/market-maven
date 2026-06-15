import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trash2 } from "lucide-react";

import { addWatch, listWatchlist, removeWatch } from "@/lib/data.functions";
import { getQuotes } from "@/lib/stocks.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/watchlist")({
  head: () => ({ meta: [{ title: "Watchlist · QuantumTrade" }] }),
  component: WatchPage,
});

function WatchPage() {
  const qc = useQueryClient();
  const [sym, setSym] = useState("");
  const listFn = useServerFn(listWatchlist);
  const addFn = useServerFn(addWatch);
  const rmFn = useServerFn(removeWatch);
  const quotesFn = useServerFn(getQuotes);

  const list = useQuery({ queryKey: ["watchlist"], queryFn: () => listFn() });
  const symbols = list.data?.map((w) => w.symbol) ?? [];
  const quotes = useQuery({
    queryKey: ["quotes", symbols.join(",")],
    queryFn: () => quotesFn({ data: { symbols } }),
    enabled: symbols.length > 0,
  });
  const byS = Object.fromEntries((quotes.data ?? []).map((q) => [q.symbol, q]));

  const add = useMutation({
    mutationFn: () => addFn({ data: { symbol: sym.toUpperCase() } }),
    onSuccess: () => { setSym(""); qc.invalidateQueries({ queryKey: ["watchlist"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const rm = useMutation({
    mutationFn: (id: string) => rmFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist"] }),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Watchlist</h1>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Add symbol</CardTitle></CardHeader>
        <CardContent className="flex gap-2">
          <Input value={sym} onChange={(e) => setSym(e.target.value)} placeholder="AAPL" />
          <Button disabled={!sym || add.isPending} onClick={() => add.mutate()}>Add</Button>
        </CardContent>
      </Card>
      <div className="grid gap-3">
        {list.data?.length === 0 && <div className="text-sm text-muted-foreground">Empty. Add a symbol above.</div>}
        {list.data?.map((w) => {
          const q = byS[w.symbol];
          const up = q ? q.changePct >= 0 : true;
          return (
            <div key={w.id} className="flex items-center justify-between rounded-lg border bg-card/60 p-4">
              <Link to="/stock/$symbol" params={{ symbol: w.symbol }} className="font-semibold hover:text-primary">{w.symbol}</Link>
              <div className="flex items-center gap-4">
                {q && <span className="num text-lg">{q.close.toFixed(2)}</span>}
                {q && (
                  <Badge variant="outline" className={up ? "border-bull/40 text-bull" : "border-bear/40 text-bear"}>
                    {up ? "+" : ""}{q.changePct}%
                  </Badge>
                )}
                <Button size="icon" variant="ghost" onClick={() => rm.mutate(w.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
