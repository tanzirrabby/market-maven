import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Bot, Globe2, LineChart, Sparkles } from "lucide-react";

import heroImg from "@/assets/hero.jpg";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "QuantumTrade — AI-powered trading intelligence" },
      {
        name: "description",
        content:
          "Live stock prices, World Bank macro signals, and a three-AI agent debate that delivers the most precise trading call.",
      },
      { property: "og:title", content: "QuantumTrade — AI-powered trading intelligence" },
      {
        property: "og:description",
        content: "Three AI analysts debate. One precise verdict. Built for serious traders.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 font-semibold">
          <LineChart className="h-5 w-5 text-primary" />
          Quantum<span className="text-primary">Trade</span>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm"><Link to="/auth">Sign in</Link></Button>
          <Button asChild size="sm"><Link to="/auth">Get started</Link></Button>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-12 px-6 py-12 md:grid-cols-2 md:py-24">
        <div className="flex flex-col justify-center gap-6">
          <span className="w-fit rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs uppercase tracking-widest text-primary">
            3-Agent AI Debate · Live Markets · Macro Signals
          </span>
          <h1 className="text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl">
            Three AI analysts.<br />
            <span className="text-primary">One precise verdict.</span>
          </h1>
          <p className="max-w-lg text-muted-foreground">
            QuantumTrade pulls live prices, blends in World Bank macro indicators, and pits
            Gemini 3 Flash, GPT-5, and Gemini 2.5 Pro against each other. A senior synthesizer
            distills their debate into a single, confident call.
          </p>
          <div className="flex gap-3">
            <Button asChild size="lg" className="glow">
              <Link to="/auth">Launch the terminal <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-4 pt-6 text-sm">
            <Stat label="AI agents" value="3+1" />
            <Stat label="Macro indicators" value="World Bank" />
            <Stat label="Market data" value="Live" />
          </div>
        </div>
        <div className="relative">
          <img
            src={heroImg}
            alt="Trading dashboard visualization"
            className="rounded-2xl border border-border shadow-2xl glow"
          />
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-24 md:grid-cols-3">
        <Feature icon={Bot} title="Multi-agent debate" desc="Three frontier models reason independently, then a portfolio-manager AI synthesizes the most precise call." />
        <Feature icon={Globe2} title="Macro context" desc="Live World Bank indicators — GDP growth, inflation, unemployment, rates — feed every analysis." />
        <Feature icon={Sparkles} title="Built for action" desc="Watchlists, portfolio tracker, price alerts, and saved analyses you can revisit anytime." />
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="num text-2xl font-bold text-primary">{value}</div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function Feature({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="rounded-xl border bg-card/60 p-6 backdrop-blur">
      <Icon className="mb-3 h-5 w-5 text-primary" />
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}
