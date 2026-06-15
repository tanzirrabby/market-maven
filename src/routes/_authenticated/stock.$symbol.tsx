import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles, Star, StarOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { getHistory, getQuote, getWorldBank } from "@/lib/stocks.functions";
import { analyzeStock } from "@/lib/agents.functions";
import { addWatch, listWatchlist, removeWatch, saveAnalysis } from "@/lib/data.functions";
import { AgentDebate, type AnalysisResult } from "@/components/agent-debate";
import { StockChart } from "@/components/stock-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/stock/$symbol")({
  head: ({ params }) => ({ meta: [{ title: `${params.symbol} · QuantumTrade` }] }),
  component: StockPage,
});

function StockPage() {
  const { symbol } = Route.useParams();
  const upper = symbol.toUpperCase();
  const qc = useQueryClient();
  const quoteFn = useServerFn(getQuote);
  const histFn = useServerFn(getHistory);
  const wbFn = useServerFn(getWorldBank);
  const analyzeFn = useServerFn(analyzeStock);
  const addFn = useServerFn(addWatch);
  const rmFn = useServerFn(removeWatch);
  const listFn = useServerFn(listWatchlist);
  const saveFn = useServerFn(saveAnalysis);

  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const quote = useQuery({ queryKey: ["quote", upper], queryFn: () => quoteFn({ data: { symbol: upper } }) });
  const history = useQuery({ queryKey: ["hist", upper], queryFn: () => histFn({ data: { symbol: upper } }) });
  const wb = useQuery({ queryKey: ["wb", "USA"], queryFn: () => wbFn({ data: { country: "USA" } }) });
  const watch = useQuery({ queryKey: ["watchlist"], queryFn: () => listFn() });
  const watched = watch.data?.find((w) => w.symbol === upper);

  const analyze = useMutation({
    mutationFn: async () => {
      const r = await analyzeFn({
        data: {
          symbol: upper,
          question: question || undefined,
          quote: quote.data,
          history: history.data,
          worldBank: wb.data,
        },
      });
      return r as AnalysisResult;
    },
    onSuccess: async (r) => {
      setResult(r);
      try {
        await saveFn({ data: { symbol: upper, question: question || undefined, result: r } });
      } catch { /* ignore */ }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Analysis failed"),
  });

  const toggleWatch = useMutation({
    mutationFn: async () => {
      if (watched) await rmFn({ data: { id: watched.id } });
      else await addFn({ data: { symbol: upper } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist"] }),
  });

  const q = quote.data;
  const up = q ? q.changePct >= 0 : true;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">{upper}</h1>
            <Button variant="ghost" size="sm" onClick={() => toggleWatch.mutate()}>
              {watched ? <StarOff className="h-4 w-4" /> : <Star className="h-4 w-4" />}
            </Button>
          </div>
          {q ? (
            <div className="mt-1 flex items-center gap-3">
              <span className="num text-3xl font-bold">{q.close.toFixed(2)}</span>
              <Badge variant="outline" className={up ? "border-bull/40 text-bull" : "border-bear/40 text-bear"}>
                {up ? "+" : ""}{q.change.toFixed(2)} ({q.changePct}%)
              </Badge>
              <span className="text-xs text-muted-foreground">{q.date} {q.time}</span>
            </div>
          ) : quote.isLoading ? (
            <div className="mt-2 text-sm text-muted-foreground">Loading…</div>
          ) : (
            <div className="mt-2 text-sm text-bear">No data for {upper}</div>
          )}
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Price · 1Y daily</CardTitle></CardHeader>
          <CardContent>
            {history.isLoading ? <div className="h-64 animate-pulse rounded bg-secondary/40" /> : <StockChart data={history.data ?? []} />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">World Bank · USA</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {wb.data ? (
              Object.entries(wb.data.indicators).map(([k, series]) => {
                const last = series[series.length - 1];
                return (
                  <div key={k} className="flex items-center justify-between border-b border-border/60 py-1 last:border-0">
                    <span className="capitalize text-muted-foreground">{k.replace("_", " ")}</span>
                    <span className="num">
                      {last ? `${last.value?.toFixed(2)} (${last.year})` : "—"}
                    </span>
                  </div>
                );
              })
            ) : <div className="text-muted-foreground">Loading…</div>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Ask the bench</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={`e.g. Is ${upper} a buy on a 6-month horizon?`}
            />
            <Button onClick={() => analyze.mutate()} disabled={analyze.isPending || !quote.data}>
              {analyze.isPending ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Debating…</> : "Run 3-agent debate"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Gemini 3 Flash · GPT-5 · Gemini 2.5 Pro analyze independently, then a senior PM synthesizes the call.
          </p>
        </CardContent>
      </Card>

      {result && <AgentDebate result={result} />}
    </div>
  );
}
