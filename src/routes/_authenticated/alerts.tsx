import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { addAlert, listAlerts, removeAlert } from "@/lib/data.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/alerts")({
  head: () => ({ meta: [{ title: "Alerts · QuantumTrade" }] }),
  component: AlertsPage,
});

function AlertsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAlerts);
  const addFn = useServerFn(addAlert);
  const rmFn = useServerFn(removeAlert);

  const [sym, setSym] = useState("");
  const [price, setPrice] = useState("");
  const [dir, setDir] = useState<"above" | "below">("above");

  const list = useQuery({ queryKey: ["alerts"], queryFn: () => listFn() });
  const add = useMutation({
    mutationFn: () =>
      addFn({ data: { symbol: sym.toUpperCase(), target_price: Number(price), direction: dir } }),
    onSuccess: () => {
      setSym(""); setPrice("");
      qc.invalidateQueries({ queryKey: ["alerts"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const rm = useMutation({
    mutationFn: (id: string) => rmFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Price alerts</h1>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Create alert</CardTitle></CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-4">
          <Input placeholder="Symbol" value={sym} onChange={(e) => setSym(e.target.value)} />
          <Select value={dir} onValueChange={(v) => setDir(v as "above" | "below")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="above">Above</SelectItem>
              <SelectItem value="below">Below</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Target price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          <Button onClick={() => add.mutate()} disabled={!sym || !price || add.isPending}>Add</Button>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {list.data?.length === 0 && <div className="text-sm text-muted-foreground">No alerts yet.</div>}
        {list.data?.map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded-lg border bg-card/60 p-4">
            <div className="flex items-center gap-3">
              <Bell className="h-4 w-4 text-primary" />
              <div className="font-semibold">{a.symbol}</div>
              <Badge variant="outline">
                {a.direction} ${Number(a.target_price).toFixed(2)}
              </Badge>
              {a.triggered && <Badge className="bg-bull/20 text-bull">triggered</Badge>}
            </div>
            <Button size="icon" variant="ghost" onClick={() => rm.mutate(a.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Alerts are saved to your account. Background trigger evaluation can be added with a scheduled job.
      </p>
    </div>
  );
}
