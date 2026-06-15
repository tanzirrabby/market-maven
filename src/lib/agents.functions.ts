import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";

import { createLovableAiGatewayProvider } from "./ai-gateway.server";

export type AgentReply = {
  id: string;
  name: string;
  model: string;
  recommendation: "BUY" | "HOLD" | "SELL" | "UNKNOWN";
  confidence: number;
  thesis: string;
  bullets: string[];
  error?: string;
};

const AGENTS = [
  {
    id: "flash",
    name: "Gemini 3 Flash — Fast Analyst",
    model: "google/gemini-3-flash-preview",
    system:
      "You are a fast quantitative analyst. Be decisive, terse, focus on the most recent price action and technicals.",
  },
  {
    id: "gpt5",
    name: "GPT-5 — Fundamental & Macro",
    model: "openai/gpt-5",
    system:
      "You are a senior fundamental + macro analyst. Weigh valuation, earnings quality, sector context, and the macro backdrop from World Bank indicators when provided.",
  },
  {
    id: "pro",
    name: "Gemini 2.5 Pro — Deep Reasoner",
    model: "google/gemini-2.5-pro",
    system:
      "You are a contrarian deep-reasoning analyst. Stress-test the consensus, surface non-obvious risks, then commit to a call.",
  },
];

const SCHEMA_HINT = `Reply STRICTLY as compact JSON, no prose around it:
{
 "recommendation": "BUY" | "HOLD" | "SELL",
 "confidence": 0-100,
 "thesis": "one paragraph",
 "bullets": ["max 4 short bullet points"]
}`;

function safeParse(text: string): {
  recommendation: AgentReply["recommendation"];
  confidence: number;
  thesis: string;
  bullets: string[];
} {
  try {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("no json");
    const j = JSON.parse(m[0]);
    const rec = String(j.recommendation ?? "HOLD").toUpperCase();
    return {
      recommendation: (["BUY", "HOLD", "SELL"].includes(rec) ? rec : "HOLD") as AgentReply["recommendation"],
      confidence: Math.max(0, Math.min(100, Number(j.confidence) || 50)),
      thesis: String(j.thesis ?? text.slice(0, 400)),
      bullets: Array.isArray(j.bullets) ? j.bullets.slice(0, 4).map(String) : [],
    };
  } catch {
    return {
      recommendation: "UNKNOWN",
      confidence: 0,
      thesis: text.slice(0, 400),
      bullets: [],
    };
  }
}

export const analyzeStock = createServerFn({ method: "POST" })
  .inputValidator((d: {
    symbol: string;
    question?: string;
    quote?: unknown;
    history?: unknown;
    worldBank?: unknown;
  }) =>
    z
      .object({
        symbol: z.string().min(1).max(12),
        question: z.string().max(500).optional(),
        quote: z.any().optional(),
        history: z.any().optional(),
        worldBank: z.any().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);

    const history = Array.isArray(data.history) ? data.history.slice(-30) : [];
    const context = `Symbol: ${data.symbol}
Latest quote: ${JSON.stringify(data.quote ?? {})}
Recent 30 daily candles: ${JSON.stringify(history)}
Macro (World Bank): ${JSON.stringify(data.worldBank ?? {})}
User question: ${data.question || "Should I buy, hold, or sell right now?"}
${SCHEMA_HINT}`;

    const calls = AGENTS.map(async (agent): Promise<AgentReply> => {
      try {
        const { text } = await generateText({
          model: gateway(agent.model),
          system: agent.system,
          prompt: context,
        });
        console.log(`[agent ${agent.id}] text length=${text?.length ?? 0}`);
        if (!text || text.trim().length === 0) {
          return {
            id: agent.id, name: agent.name, model: agent.model,
            recommendation: "UNKNOWN", confidence: 0, thesis: "", bullets: [],
            error: "Model returned empty response",
          };
        }
        const parsed = safeParse(text);
        return { id: agent.id, name: agent.name, model: agent.model, ...parsed };
      } catch (e) {
        console.error(`[agent ${agent.id}] error:`, e);
        return {
          id: agent.id,
          name: agent.name,
          model: agent.model,
          recommendation: "UNKNOWN",
          confidence: 0,
          thesis: "",
          bullets: [],
          error: e instanceof Error ? e.message : String(e),
        };
      }
    });

    const agents = await Promise.all(calls);
    console.log(`[agents] completed`, agents.map(a => ({ id: a.id, rec: a.recommendation, err: a.error })));


    // Judge: synthesize a single, precise call
    const judgePrompt = `Three analysts evaluated ${data.symbol}. Their JSON replies:
${JSON.stringify(agents, null, 2)}

Decide the most PRECISE final call by weighing where they agree, where they diverge, and the strength of each thesis. Reply STRICTLY as JSON:
{
 "recommendation": "BUY" | "HOLD" | "SELL",
 "confidence": 0-100,
 "summary": "2-3 sentence executive summary",
 "agreements": ["points all/most agree on"],
 "disagreements": ["key conflicts"],
 "action_plan": ["3-5 concrete next steps for the trader"]
}`;

    let verdict: {
      recommendation: string;
      confidence: number;
      summary: string;
      agreements: string[];
      disagreements: string[];
      action_plan: string[];
    } = {
      recommendation: "HOLD",
      confidence: 0,
      summary: "Could not synthesize.",
      agreements: [],
      disagreements: [],
      action_plan: [],
    };
    try {
      const { text } = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        system: "You are a senior portfolio manager synthesizing analyst views into one precise call. Reply with JSON only, no prose.",
        prompt: judgePrompt,
      });
      console.log(`[judge] text length=${text?.length ?? 0}`);
      const m = text?.match(/\{[\s\S]*\}/);
      if (m) {
        const j = JSON.parse(m[0]);
        verdict = {
          recommendation: String(j.recommendation ?? "HOLD").toUpperCase(),
          confidence: Math.max(0, Math.min(100, Number(j.confidence) || 50)),
          summary: String(j.summary ?? ""),
          agreements: Array.isArray(j.agreements) ? j.agreements.map(String) : [],
          disagreements: Array.isArray(j.disagreements) ? j.disagreements.map(String) : [],
          action_plan: Array.isArray(j.action_plan) ? j.action_plan.map(String) : [],
        };
      } else {
        verdict.summary = text?.slice(0, 400) || "Judge returned no parseable output.";
      }
    } catch (e) {
      console.error(`[judge] error:`, e);
      verdict.summary = e instanceof Error ? e.message : String(e);
    }

    return { agents, verdict, symbol: data.symbol.toUpperCase(), createdAt: new Date().toISOString() };
  });
