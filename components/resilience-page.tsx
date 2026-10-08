"use client";

import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  AlertOctagon,
  Boxes,
  CheckCircle2,
  CloudCog,
  Cpu,
  Download,
  Network,
  RotateCcw,
  Server,
  Shield,
  Sparkles,
  TimerReset,
  Users,
  Wifi,
  XCircle,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { defaultConfig, deployments, formatCompact, simulate } from "@/lib/nts-model";

type Scenario = "nodeFailure" | "podRestart" | "contention" | "autoscale";

const scenarios: { id: Scenario; label: string; description: string; icon: typeof Server }[] = [
  { id: "nodeFailure", label: "Node failure", description: "Remove one Kubernetes worker", icon: XCircle },
  { id: "podRestart", label: "Pod restart", description: "Rotate one NTS service pod", icon: RotateCcw },
  { id: "contention", label: "CPU contention", description: "Inject a noisy neighbor", icon: Cpu },
  { id: "autoscale", label: "Horizontal scale", description: "Enable capacity response", icon: Boxes },
];

export function ResiliencePage() {
  const [active, setActive] = useState<Scenario[]>(["nodeFailure"]);
  const [pods, setPods] = useState(4);
  const [selectedNode, setSelectedNode] = useState("nts-pod-2");

  const toggle = (id: Scenario) => setActive((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const state = useMemo(() => {
    const failure = active.includes("nodeFailure");
    const restart = active.includes("podRestart");
    const contention = active.includes("contention");
    const autoscale = active.includes("autoscale");
    const effectivePods = Math.max(1, pods - (failure ? 2 : 0) - (restart ? 1 : 0) + (autoscale ? 2 : 0));
    const capacity = effectivePods * 28000 * (contention ? 0.72 : 1);
    const availability = Math.max(94, 99.995 - (failure ? 0.32 : 0) - (restart ? 0.08 : 0) - (contention ? 0.11 : 0) + (autoscale ? 0.17 : 0));
    const recovery = Math.max(4, (failure ? 44 : 8) + (restart ? 13 : 0) + (contention ? 7 : 0) - (autoscale ? 20 : 0));
    return { failure, restart, contention, autoscale, effectivePods, capacity, availability, recovery };
  }, [active, pods]);

  const timeline = useMemo(() => [0, 10, 20, 30, 45, 60, 90, 120].map((second) => {
    const dip = state.failure ? Math.max(0.45, 1 - Math.max(0, 1 - second / state.recovery) * 0.58) : state.restart ? Math.max(0.72, second / state.recovery) : 1;
    const scale = state.autoscale && second > 30 ? Math.min(1.14, 1 + (second - 30) / 600) : 1;
    return { second, capacity: Math.round(state.capacity * dip * scale), baseline: pods * 28000 };
  }), [state, pods]);

  useEffect(() => {
    const modelContext = (document as Document & {
      modelContext?: {
        registerTool: (tool: unknown, options?: { signal?: AbortSignal }) => void | Promise<void>;
      };
    }).modelContext;
    if (!modelContext?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(modelContext.registerTool({
      name: "configure_resilience_scenario",
      title: "Configure resilience scenario",
      description: "Set active failure simulations and replica count in the visible NTSBench topology.",
      inputSchema: {
        type: "object",
        properties: {
          activeScenarios: { type: "array", items: { type: "string", enum: ["nodeFailure", "podRestart", "contention", "autoscale"] }, uniqueItems: true },
          pods: { type: "integer", minimum: 2, maximum: 6 },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input: unknown) {
        if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Input must be an object.");
        const values = input as { activeScenarios?: Scenario[]; pods?: number };
        if (values.pods !== undefined && (!Number.isInteger(values.pods) || values.pods < 2 || values.pods > 6)) throw new Error("pods is outside the supported range.");
        if (values.activeScenarios !== undefined) {
          if (!Array.isArray(values.activeScenarios) || values.activeScenarios.some((item) => !["nodeFailure", "podRestart", "contention", "autoscale"].includes(item))) throw new Error("activeScenarios contains an unsupported scenario.");
          setActive([...new Set(values.activeScenarios)]);
        }
        if (values.pods !== undefined) setPods(values.pods);
        return { status: "configured", applied: values };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  const reportHref = useMemo(() => {
    const base = deployments.map((d) => simulate(defaultConfig, d));
    const content = `# NTSBench Synthetic Research Report\n\nGenerated: ${new Date().toISOString()}\n\n> This report contains deterministic synthetic estimates, not measured Netnod results.\n\n## Scenario\n- Active simulations: ${active.length ? active.join(", ") : "steady state"}\n- Configured pods: ${pods}\n- Effective pods: ${state.effectivePods}\n- Estimated service capacity: ${state.capacity.toLocaleString()} queries/sec\n- Estimated availability: ${state.availability.toFixed(3)}%\n- Estimated recovery: ${state.recovery} seconds\n\n## Baseline performance model\n${base.map((r) => `- ${r.deployment}: ${r.throughput.toLocaleString()} qps, P99 ${r.p99} ms, CPU ${r.cpu}%`).join("\n")}\n\n## Assumptions\n- NTS key establishment uses TLS and is modeled separately from NTP time queries.\n- Each client establishes one NTS session every 15 minutes.\n- Time queries reuse NTS cookies; TLS is not run per query.\n- Capacity and recovery values are comparative synthetic estimates only.\n- No real NTS endpoint or production telemetry is connected.\n`;
    return `data:text/markdown;charset=utf-8,${encodeURIComponent(content)}`;
  }, [active, pods, state]);

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300"><span className="size-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_#36e3ff]" /> Resilience / Scenario lab</div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Failure, recovery & optimization</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Stress the service topology, inspect blast radius, and export a reproducible synthetic research summary.</p>
        </div>
        <Button asChild className="bg-cyan-300 text-[#041018] hover:bg-cyan-200">
          <a href={reportHref} download="ntsbench-research-report.md"><Download /> Export report</a>
        </Button>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(330px,.55fr)]">
        <section className="overflow-hidden rounded-xl border border-white/10 bg-[#091722]/85">
          <div className="flex flex-col justify-between gap-4 border-b border-white/8 p-5 sm:flex-row sm:items-center">
            <div><h2 className="font-semibold text-white">NTS service topology</h2><p className="mt-1 text-xs text-slate-500">Select a component to inspect it</p></div>
            <div className="flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/5 px-3 py-1.5 text-xs text-emerald-300"><span className="size-1.5 rounded-full bg-emerald-300" /> {state.effectivePods}/{pods + (state.autoscale ? 2 : 0)} pods serving</div>
          </div>
          <div className="relative min-h-[470px] overflow-hidden p-5 sm:p-8">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(54,227,255,.03)_1px,transparent_1px),linear-gradient(90deg,rgba(54,227,255,.03)_1px,transparent_1px)] bg-[size:28px_28px]" />
            <div className="relative grid min-h-[405px] items-center gap-8 lg:grid-cols-[170px_100px_minmax(0,1fr)]">
              <DiagramGroup label="Client pool" icon={Users}>
                <DiagramNode id="nts-clients" selected={selectedNode === "nts-clients"} onClick={setSelectedNode} icon={Users} title="24k clients" subtitle="72k query/s" />
                <DiagramNode id="rekey-workers" selected={selectedNode === "rekey-workers"} onClick={setSelectedNode} icon={Shield} title="Rekey cohort" subtitle="27 TLS/s" />
              </DiagramGroup>
              <div className="flex flex-col items-center gap-2 text-center text-xs text-slate-500"><Wifi className="size-7 text-cyan-300" /><span className="font-mono">UDP/123</span><span className="font-mono">TCP/4460</span></div>
              <div className={`rounded-2xl border p-4 transition-colors ${state.failure ? "border-red-400/25 bg-red-400/[0.035]" : "border-cyan-300/15 bg-cyan-300/[0.025]"}`}>
                <div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-medium text-white"><CloudCog className="size-4 text-cyan-300" /> Kubernetes cluster</div><span className="font-mono text-[10px] text-slate-500">3 WORKERS</span></div>
                <div className="grid gap-3 md:grid-cols-3">
                  {[1, 2, 3].map((node) => {
                    const failed = state.failure && node === 2;
                    return (
                      <div key={node} className={`rounded-xl border p-3 ${failed ? "border-red-400/30 bg-red-400/7" : "border-white/9 bg-[#07131d]"}`}>
                        <button onClick={() => setSelectedNode(`worker-${node}`)} className="mb-3 flex w-full items-center justify-between text-left"><span className="flex items-center gap-2 text-xs font-medium text-slate-200"><Server className={`size-3.5 ${failed ? "text-red-300" : "text-slate-400"}`} /> node-{node}</span>{failed ? <XCircle className="size-3.5 text-red-300" /> : <CheckCircle2 className="size-3.5 text-emerald-400" />}</button>
                        <div className="space-y-2">
                          {[0, 1].map((pod) => {
                            const id = `nts-pod-${(node - 1) * 2 + pod + 1}`;
                            const podNumber = Number(id.split("-").pop());
                            const disabled = podNumber > pods + (state.autoscale ? 2 : 0);
                            const offline = failed || (state.restart && node === 3 && pod === 1) || disabled;
                            return <button key={id} disabled={disabled} onClick={() => setSelectedNode(id)} className={`flex w-full items-center gap-2 rounded-md border px-2 py-2 text-left text-[11px] transition-colors ${selectedNode === id ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-100" : offline ? "border-white/5 bg-black/20 text-slate-600" : "border-white/8 bg-white/[0.025] text-slate-300 hover:border-white/15"}`}><Boxes className="size-3" /><span className="truncate">{id}</span><span className={`ml-auto size-1.5 rounded-full ${offline ? "bg-red-400" : state.contention && node === 1 ? "bg-amber-300" : "bg-emerald-400"}`} /></button>;
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2"><DiagramNode id="load-balancer" selected={selectedNode === "load-balancer"} onClick={setSelectedNode} icon={Network} title="Service / Load balancer" subtitle="Topology-aware routing" /><DiagramNode id="time-source" selected={selectedNode === "time-source"} onClick={setSelectedNode} icon={TimerReset} title="Clock source" subtitle="Kernel + PHC reference" /></div>
              </div>
            </div>
          </div>
          <div className="grid border-t border-white/8 bg-black/10 sm:grid-cols-3">
            <MiniMetric label="Selected" value={selectedNode} /><MiniMetric label="Estimated capacity" value={`${formatCompact(state.capacity)} qps`} /><MiniMetric label="Recovery objective" value={`${state.recovery}s`} />
          </div>
        </section>

        <aside className="space-y-6">
          <section className="rounded-xl border border-white/10 bg-[#091722]/85 p-5">
            <div className="mb-5"><h2 className="font-semibold text-white">Scenario controls</h2><p className="mt-1 text-xs text-slate-500">Changes apply to the topology</p></div>
            <div className="space-y-2">
              {scenarios.map((scenario) => {
                const Icon = scenario.icon;
                const checked = active.includes(scenario.id);
                return (
                  <div key={scenario.id} className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${checked ? "border-cyan-300/20 bg-cyan-300/5" : "border-white/7 bg-white/[0.015]"}`}>
                    <span className={`grid size-8 shrink-0 place-items-center rounded-md ${checked ? "bg-cyan-300/10 text-cyan-300" : "bg-white/5 text-slate-500"}`}><Icon className="size-4" /></span>
                    <button className="min-w-0 flex-1 text-left" onClick={() => toggle(scenario.id)}><span className="block text-sm text-slate-200">{scenario.label}</span><span className="block truncate text-xs text-slate-500">{scenario.description}</span></button>
                    <Switch checked={checked} onCheckedChange={() => toggle(scenario.id)} aria-label={scenario.label} className="data-[state=checked]:bg-cyan-300" />
                  </div>
                );
              })}
            </div>
            <div className="mt-6 border-t border-white/8 pt-5"><div className="mb-3 flex items-center justify-between text-sm"><span className="text-slate-300">Base replica count</span><span className="font-mono text-cyan-200">{pods} pods</span></div><Slider min={2} max={6} step={1} value={[pods]} onValueChange={([v]) => setPods(v)} /></div>
          </section>

          <section className="rounded-xl border border-white/10 bg-[#091722]/85 p-5">
            <div className="mb-4 flex items-center gap-2"><Sparkles className="size-4 text-cyan-300" /><h2 className="font-semibold text-white">Optimization queue</h2></div>
            <div className="space-y-3">
              <Suggestion icon={Cpu} title="Pin crypto workers" text="Reserve two physical cores for NTS-KE and isolate query workers." impact="P99 −18%" />
              <Suggestion icon={Zap} title="Set CPU guarantees" text={state.contention ? "Contention is active; apply equal requests and limits to avoid CFS throttling." : "Use Guaranteed QoS to protect the packet and crypto paths."} impact="Jitter −12%" />
              <Suggestion icon={Network} title="Localize traffic" text="Prefer host networking or tune CNI batching; keep clients node-local when possible." impact="QPS +9%" />
              {state.failure && <Suggestion icon={AlertOctagon} title="Spread replicas" text="Enforce topology spread across three workers before increasing replicas." impact="RTO −20s" />}
            </div>
          </section>
        </aside>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
        <section className="rounded-xl border border-white/10 bg-[#091722]/85 p-5">
          <div><h2 className="font-semibold text-white">Capacity recovery</h2><p className="mb-4 mt-1 text-xs text-slate-500">Modeled service throughput after scenario injection at t=0</p></div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={timeline} margin={{ top: 10, right: 10, left: -10 }}>
              <defs><linearGradient id="recovery-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#36e3ff" stopOpacity={0.3} /><stop offset="100%" stopColor="#36e3ff" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid stroke="rgba(148,163,184,.08)" vertical={false} /><XAxis dataKey="second" stroke="#64748b" tick={{ fontSize: 11 }} unit="s" /><YAxis stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={formatCompact} /><Tooltip contentStyle={{ background: "#0a1722", border: "1px solid rgba(148,163,184,.18)", borderRadius: 10, fontSize: 12 }} /><Area type="monotone" dataKey="capacity" stroke="#36e3ff" fill="url(#recovery-fill)" strokeWidth={2} /><Area type="monotone" dataKey="baseline" stroke="#64748b" fill="transparent" strokeDasharray="5 5" />
            </AreaChart>
          </ResponsiveContainer>
        </section>

        <section className="rounded-xl border border-white/10 bg-[#091722]/85 p-5">
          <h2 className="font-semibold text-white">Deployment trade-offs</h2><p className="mb-4 mt-1 text-xs text-slate-500">Comparative assumptions at equivalent CPU allocation</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[540px] text-left text-sm">
              <thead className="border-y border-white/8 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="py-3 font-medium">Platform</th><th className="py-3 font-medium">Availability</th><th className="py-3 font-medium">Capacity</th><th className="py-3 font-medium">Recovery</th><th className="py-3 font-medium">Ops</th></tr></thead>
              <tbody>
                <TradeRow name="Bare Metal" availability="99.90%" capacity="Highest" recovery="Manual / 15m" complexity={2} />
                <TradeRow name="Docker" availability="99.95%" capacity="High" recovery="Host / 4m" complexity={3} />
                <TradeRow name="Kubernetes" availability={`${state.availability.toFixed(3)}%`} capacity={state.failure ? "Degraded" : "Elastic"} recovery={`${state.recovery}s`} complexity={5} />
              </tbody>
            </table>
          </div>
          <div className="mt-4 rounded-lg border border-cyan-300/15 bg-cyan-300/5 p-3 text-xs leading-5 text-slate-400"><strong className="text-cyan-100">Interpretation:</strong> orchestration improves automated recovery and placement options, while adding packet-path and operational overhead. Values are scenario assumptions, not production SLO evidence.</div>
        </section>
      </div>
    </div>
  );
}

function DiagramGroup({ label, icon: Icon, children }: { label: string; icon: typeof Server; children: React.ReactNode }) {
  return <div className="space-y-3"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500"><Icon className="size-3.5 text-cyan-300" />{label}</div>{children}</div>;
}

function DiagramNode({ id, selected, onClick, icon: Icon, title, subtitle }: { id: string; selected: boolean; onClick: (id: string) => void; icon: typeof Server; title: string; subtitle: string }) {
  return <button onClick={() => onClick(id)} className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all ${selected ? "border-cyan-300/40 bg-cyan-300/10 shadow-[0_0_25px_rgba(54,227,255,.07)]" : "border-white/8 bg-[#07131d] hover:border-white/18"}`}><span className="grid size-8 shrink-0 place-items-center rounded-md bg-white/5"><Icon className={`size-4 ${selected ? "text-cyan-300" : "text-slate-400"}`} /></span><span className="min-w-0"><span className="block truncate text-xs font-medium text-slate-200">{title}</span><span className="block truncate text-[10px] text-slate-500">{subtitle}</span></span></button>;
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return <div className="border-b border-white/8 px-5 py-4 last:border-0 sm:border-b-0 sm:border-r sm:last:border-r-0"><p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 truncate font-mono text-sm text-slate-200">{value}</p></div>;
}

function Suggestion({ icon: Icon, title, text, impact }: { icon: typeof Cpu; title: string; text: string; impact: string }) {
  return <div className="rounded-lg border border-white/7 bg-white/[0.02] p-3"><div className="flex items-center gap-2"><Icon className="size-3.5 text-cyan-300" /><p className="text-sm font-medium text-slate-200">{title}</p><span className="ml-auto font-mono text-[10px] text-emerald-300">{impact}</span></div><p className="mt-2 text-xs leading-5 text-slate-500">{text}</p></div>;
}

function TradeRow({ name, availability, capacity, recovery, complexity }: { name: string; availability: string; capacity: string; recovery: string; complexity: number }) {
  return <tr className="border-b border-white/6 last:border-0"><td className="py-3 font-medium text-white">{name}</td><td className="py-3 font-mono text-xs text-slate-300">{availability}</td><td className="py-3 text-xs text-slate-300">{capacity}</td><td className="py-3 text-xs text-slate-300">{recovery}</td><td className="py-3"><span className="flex gap-1">{[1, 2, 3, 4, 5].map((v) => <span key={v} className={`h-1.5 w-3 rounded-full ${v <= complexity ? "bg-cyan-300" : "bg-white/8"}`} />)}</span></td></tr>;
}
