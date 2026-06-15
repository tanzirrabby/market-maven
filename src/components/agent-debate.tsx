import { Bot, CheckCircle2, MinusCircle, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type Agent = {
  id: string;
  name: string;
  model: string;
  recommendation: string;
  confidence: number;
  thesis: string;
  bullets: string[];
  error?: string;
};

type Verdict = {
  recommendation: string;
  confidence: number;
  summary: string;
  agreements: string[];
  disagreements: string[];
  action_plan: string[];
};

export type AnalysisResult = { agents: Agent[]; verdict: Verdict; symbol: string };

function recStyle(rec: string) {
  if (rec === "BUY") return { color: "text-bull", icon: CheckCircle2, badge: "bg-bull/15 text-bull border-bull/30" };
  if (rec === "SELL") return { color: "text-bear", icon: XCircle, badge: "bg-bear/15 text-bear border-bear/30" };
  return { color: "text-gold", icon: MinusCircle, badge: "bg-gold/15 text-gold border-gold/30" };
}

export function AgentDebate({ result }: { result: AnalysisResult }) {
  const v = recStyle(result.verdict.recommendation);
  const Icon = v.icon;
  return (
    <div className="space-y-4">
      <Card className="border-primary/30 glow">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <Icon className={`h-5 w-5 ${v.color}`} />
              Synthesized verdict for {result.symbol}
            </CardTitle>
            <Badge variant="outline" className={v.badge}>
              {result.verdict.recommendation} · {result.verdict.confidence}% confidence
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">{result.verdict.summary}</p>
          <Progress value={result.verdict.confidence} />
          <div className="grid gap-4 md:grid-cols-3">
            <Block title="Agreements" items={result.verdict.agreements} />
            <Block title="Disagreements" items={result.verdict.disagreements} />
            <Block title="Action plan" items={result.verdict.action_plan} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {result.agents.map((a) => {
          const s = recStyle(a.recommendation);
          const I = s.icon;
          return (
            <Card key={a.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm">
                    <Bot className="mr-1 inline h-4 w-4 text-primary" />
                    {a.name}
                  </CardTitle>
                  <Badge variant="outline" className={s.badge}>
                    <I className="mr-1 h-3 w-3" />
                    {a.recommendation}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">{a.model}</div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {a.error ? (
                  <p className="text-bear">{a.error}</p>
                ) : (
                  <>
                    <p className="text-muted-foreground">{a.thesis}</p>
                    {a.bullets.length > 0 && (
                      <ul className="ml-4 list-disc space-y-1 text-xs">
                        {a.bullets.map((b, i) => <li key={i}>{b}</li>)}
                      </ul>
                    )}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">Confidence</span>
                      <Progress value={a.confidence} className="h-1.5" />
                      <span className="num">{a.confidence}%</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Block({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">{title}</div>
      {items.length === 0 ? (
        <div className="text-xs text-muted-foreground">—</div>
      ) : (
        <ul className="ml-4 list-disc space-y-1 text-xs">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
      )}
    </div>
  );
}
