"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, Cpu, FileUp, Gauge, Info, RotateCcw, TimerReset, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  defaultConfig,
  deploymentColor,
  deployments,
  formatCompact,
  LabConfig,
  makeLoadSeries,
  NetworkCondition,
  Result,
  simulate,
} from "@/lib/nts-model";

const tooltipStyle = {
  background: "#0a1722",
  border: "1px solid rgba(148,163,184,.18)",
  borderRadius: 10,
  color: "#dbeafe",
  fontSize: 12,
};

function Control({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <label className="text-sm text-slate-300">{label}</label>
        <span className="font-mono text-xs text-cyan-200">{value}</span>
      </div>
      {children}
    </div>
  );
}

export function LabPage() {
  const [config, setConfig] = useState<LabConfig>(defaultConfig);
  const [imported, setImported] = useState<Result[] | null>(null);
  const [importMessage, setImportMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const modeled = useMemo(() => deployments.map((d) => simulate(config, d)), [config]);
  const results = imported ?? modeled;
  const series = useMemo(() => makeLoadSeries(config), [config]);
  const best = results.reduce((a, b) => (a.throughput > b.throughput ? a : b));
  const highestCpu = Math.max(...results.map((r) => r.cpu));
  const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);

  useEffect(() => {
    const modelContext = (document as Document & {
      modelContext?: {
        registerTool: (tool: unknown, options?: { signal?: AbortSignal }) => void | Promise<void>;
      };
    }).modelContext;
    if (!modelContext?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(modelContext.registerTool({
      name: "configure_nts_benchmark",
      title: "Configure NTS benchmark",
      description: "Set the visible NTSBench performance inputs and recalculate the comparison.",
      inputSchema: {
        type: "object",
        properties: {
          clients: { type: "integer", minimum: 1000, maximum: 100000 },
          rps: { type: "integer", minimum: 5000, maximum: 240000 },
          tlsOverheadMs: { type: "number", minimum: 0, maximum: 12 },
          cores: { type: "integer", minimum: 1, maximum: 16 },
          network: { type: "string", enum: ["Clean LAN", "Typical DC", "Congested"] },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input: unknown) {
        if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Input must be an object.");
        const values = input as Partial<LabConfig>;
        if (values.clients !== undefined && (!Number.isInteger(values.clients) || values.clients < 1000 || values.clients > 100000)) throw new Error("clients is outside the supported range.");
        if (values.rps !== undefined && (!Number.isInteger(values.rps) || values.rps < 5000 || values.rps > 240000)) throw new Error("rps is outside the supported range.");
        if (values.cores !== undefined && (!Number.isInteger(values.cores) || values.cores < 1 || values.cores > 16)) throw new Error("cores is outside the supported range.");
        if (values.tlsOverheadMs !== undefined && (typeof values.tlsOverheadMs !== "number" || values.tlsOverheadMs < 0 || values.tlsOverheadMs > 12)) throw new Error("tlsOverheadMs is outside the supported range.");
        if (values.network !== undefined && !["Clean LAN", "Typical DC", "Congested"].includes(values.network)) throw new Error("network is invalid.");
        setConfig((current) => ({ ...current, ...values }));
        setImported(null);
        return { status: "configured", applied: values };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  const update = <K extends keyof LabConfig>(key: K, value: LabConfig[K]) => {
    setConfig((current) => ({ ...current, [key]: value }));
    setImported(null);
    setImportMessage("");
  };

  const onCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const rows = text.trim().split(/\r?\n/).map((row) => row.split(",").map((cell) => cell.trim()));
    const headers = rows[0].map((header) => header.toLowerCase());
    const index = (name: string) => headers.indexOf(name);
    const parsed = rows.slice(1).flatMap((row) => {
      const deployment = row[index("deployment")] as Result["deployment"];
      if (!deployments.includes(deployment)) return [];
      const number = (name: string) => Number(row[index(name)] ?? 0);
      const item: Result = {
        deployment,
        throughput: number("throughput"),
        p50: number("p50"),
        p95: number("p95"),
        p99: number("p99"),
        cpu: number("cpu"),
        failed: number("failed"),
        capacity: number("throughput"),
        bottleneck: row[index("bottleneck")] || "Imported run",
        queryCpu: number("cpu"),
        keyCpu: 0,
      };
      return Number.isFinite(item.throughput) ? [item] : [];
    });
    if (parsed.length) {
      setImported(parsed);
      setImportMessage(`${parsed.length} deployment row${parsed.length === 1 ? "" : "s"} loaded from ${file.name}`);
    } else {
      setImportMessage("No valid rows. Expected deployment, throughput, p50, p95, p99, cpu, failed.");
    }
    event.target.value = "";
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
            <span className="size-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_#36e3ff]" />
            Performance lab / Run 024
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">NTS deployment performance</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Explore how query load and NTS key establishment compete for CPU across bare metal, containers, and Kubernetes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onCsv} className="hidden" aria-label="Upload benchmark CSV" />
          <Button variant="outline" onClick={() => fileRef.current?.click()} className="border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/8 hover:text-white">
            <FileUp /> Import CSV
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setConfig(defaultConfig);
              setImported(null);
              setImportMessage("");
            }}
            className="text-slate-400 hover:bg-white/5 hover:text-white"
          >
            <RotateCcw /> Reset
          </Button>
        </div>
      </section>

      {importMessage && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${imported ? "border-cyan-300/20 bg-cyan-300/5 text-cyan-100" : "border-amber-300/20 bg-amber-300/5 text-amber-100"}`}>
          {importMessage}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[330px_minmax(0,1fr)]">
        <aside className="h-fit rounded-xl border border-white/10 bg-[#091722]/90 p-5 shadow-[0_24px_70px_rgba(0,0,0,.18)] xl:sticky xl:top-24">
          <div className="flex items-center justify-between border-b border-white/8 pb-4">
            <div>
              <h2 className="font-semibold text-white">Experiment inputs</h2>
              <p className="mt-1 text-xs text-slate-500">Updates recalculate instantly</p>
            </div>
            <span className="rounded border border-cyan-300/20 bg-cyan-300/7 px-2 py-1 font-mono text-[10px] uppercase text-cyan-200">synthetic</span>
          </div>
          <div className="mt-5 space-y-6">
            <Control label="Active clients" value={config.clients.toLocaleString()}>
              <Slider min={1000} max={100000} step={1000} value={[config.clients]} onValueChange={([v]) => update("clients", v)} />
            </Control>
            <Control label="Time queries / sec" value={formatCompact(config.rps)}>
              <Slider min={5000} max={240000} step={5000} value={[config.rps]} onValueChange={([v]) => update("rps", v)} />
            </Control>
            <Control label="TLS handshake overhead" value={`+${config.tlsOverheadMs.toFixed(1)} ms`}>
              <Slider min={0} max={12} step={0.2} value={[config.tlsOverheadMs]} onValueChange={([v]) => update("tlsOverheadMs", v)} />
            </Control>
            <Control label="CPU cores" value={`${config.cores} vCPU`}>
              <Slider min={1} max={16} step={1} value={[config.cores]} onValueChange={([v]) => update("cores", v)} />
            </Control>
            <div>
              <label className="mb-2 block text-sm text-slate-300">Network condition</label>
              <Select value={config.network} onValueChange={(value) => update("network", value as NetworkCondition)}>
                <SelectTrigger className="w-full border-white/10 bg-[#061019] text-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-[#0a1722] text-slate-200">
                  <SelectItem value="Clean LAN">Clean LAN · 0.08 ms</SelectItem>
                  <SelectItem value="Typical DC">Typical DC · 0.22 ms</SelectItem>
                  <SelectItem value="Congested">Congested · 0.72 ms</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-6 rounded-lg border border-white/8 bg-black/15 p-3 text-xs leading-5 text-slate-400">
            <div className="mb-1 flex items-center gap-2 font-medium text-slate-300"><Info className="size-3.5 text-cyan-300" /> Stage model</div>
            Key establishment is modeled separately at one TLS session per client every 15 minutes. Time queries use NTP + NTS cookies and do not rerun TLS.
          </div>
        </aside>

        <div className="min-w-0 space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric icon={Gauge} label="Best throughput" value={`${formatCompact(best.throughput)} qps`} detail={best.deployment} accent="cyan" />
            <Metric icon={TimerReset} label="Lowest P99" value={`${Math.min(...results.map((r) => r.p99)).toFixed(2)} ms`} detail="end-to-end model" accent="violet" />
            <Metric icon={Cpu} label="Peak CPU" value={`${highestCpu.toFixed(1)}%`} detail={highestCpu > 92 ? "saturation risk" : "within envelope"} accent={highestCpu > 92 ? "amber" : "cyan"} />
            <Metric icon={AlertTriangle} label="Failed / minute" value={formatCompact(totalFailed)} detail={totalFailed ? "capacity exceeded" : "no modeled loss"} accent={totalFailed ? "amber" : "cyan"} />
          </div>

          <section className="rounded-xl border border-white/10 bg-[#091722]/85 p-4 sm:p-5">
            <div className="mb-5 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <div>
                <h2 className="font-semibold text-white">Deployment envelope</h2>
                <p className="mt-1 text-xs text-slate-500">Current point estimate · one-minute observation window</p>
              </div>
              <div className="flex items-center gap-3 text-[11px] uppercase tracking-wider text-slate-500">
                <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-cyan-300" /> mode: {imported ? "imported" : "model"}</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-y border-white/8 text-[11px] uppercase tracking-[0.12em] text-slate-500">
                  <tr>
                    <th className="px-3 py-3 font-medium">Deployment</th><th className="px-3 py-3 font-medium">Throughput</th><th className="px-3 py-3 font-medium">P50 / P95 / P99</th><th className="px-3 py-3 font-medium">CPU</th><th className="px-3 py-3 font-medium">Stage load</th><th className="px-3 py-3 font-medium">Bottleneck</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((row) => (
                    <tr key={row.deployment} className="border-b border-white/6 last:border-0">
                      <td className="px-3 py-4 font-medium text-white"><span className="mr-2 inline-block size-2 rounded-full" style={{ background: deploymentColor(row.deployment) }} />{row.deployment}</td>
                      <td className="px-3 py-4 font-mono text-slate-200">{row.throughput.toLocaleString()} <span className="text-xs text-slate-600">qps</span></td>
                      <td className="px-3 py-4 font-mono text-xs text-slate-300">{row.p50} / {row.p95} / <span className="text-cyan-200">{row.p99} ms</span></td>
                      <td className="px-3 py-4"><div className="flex items-center gap-2"><div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-cyan-300" style={{ width: `${Math.min(100, row.cpu)}%` }} /></div><span className="font-mono text-xs text-slate-300">{row.cpu}%</span></div></td>
                      <td className="px-3 py-4 text-xs text-slate-400">Query {row.queryCpu}% · KE {row.keyCpu}%</td>
                      <td className="px-3 py-4"><span className={`rounded-full border px-2 py-1 text-[11px] ${row.bottleneck === "Headroom available" ? "border-emerald-300/15 bg-emerald-300/5 text-emerald-300" : "border-amber-300/15 bg-amber-300/5 text-amber-200"}`}>{row.bottleneck}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid gap-6 2xl:grid-cols-2">
            <ChartCard title="P99 latency under load" subtitle="Queueing knee appears as capacity is exceeded">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={series} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(148,163,184,.09)" vertical={false} />
                  <XAxis dataKey="rps" stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={formatCompact} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 11 }} unit="ms" />
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => `${Number(v).toLocaleString()} qps`} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  {deployments.map((d) => <Line key={d} type="monotone" dataKey={`${d}-p99`} name={d} stroke={deploymentColor(d)} strokeWidth={2} dot={false} />)}
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Throughput delivered" subtitle="Requested load versus processed time queries">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={series} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                  <defs>{deployments.map((d) => <linearGradient key={d} id={`fill-${d.replace(" ", "-")}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={deploymentColor(d)} stopOpacity={0.28} /><stop offset="100%" stopColor={deploymentColor(d)} stopOpacity={0} /></linearGradient>)}</defs>
                  <CartesianGrid stroke="rgba(148,163,184,.09)" vertical={false} />
                  <XAxis dataKey="rps" stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={formatCompact} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={formatCompact} />
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => `${Number(v).toLocaleString()} requested qps`} />
                  {deployments.map((d) => <Area key={d} type="monotone" dataKey={`${d}-throughput`} name={d} stroke={deploymentColor(d)} fill={`url(#fill-${d.replace(" ", "-")})`} strokeWidth={2} />)}
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <section className="grid gap-6 rounded-xl border border-white/10 bg-[#091722]/85 p-5 lg:grid-cols-[1fr_1.25fr]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-300">Cost decomposition</p>
              <h2 className="mt-2 text-lg font-semibold text-white">Key establishment vs. time queries</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">TLS overhead affects the key-establishment stage only. Increasing active clients raises periodic handshake demand; increasing query rate raises the cookie-authenticated NTP stage.</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="rounded border border-cyan-300/15 bg-cyan-300/5 px-2.5 py-1.5 text-cyan-100">KE: {Math.max(1, Math.round(config.clients / 900))} TLS/s</span>
                <span className="rounded border border-violet-300/15 bg-violet-300/5 px-2.5 py-1.5 text-violet-100">Queries: {formatCompact(config.rps)} NTP/s</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={185}>
              <BarChart data={modeled} layout="vertical" margin={{ left: 8, right: 18 }}>
                <CartesianGrid stroke="rgba(148,163,184,.08)" horizontal={false} />
                <XAxis type="number" stroke="#64748b" tick={{ fontSize: 11 }} unit="%" />
                <YAxis type="category" dataKey="deployment" width={82} stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="queryCpu" name="Time-query CPU" stackId="cpu" fill="#36e3ff" radius={[3, 0, 0, 3]} />
                <Bar dataKey="keyCpu" name="Key-establishment CPU" stackId="cpu" fill="#a78bfa" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>
        </div>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, detail, accent }: { icon: typeof Users; label: string; value: string; detail: string; accent: "cyan" | "violet" | "amber" }) {
  const colors = { cyan: "text-cyan-300 bg-cyan-300/8 border-cyan-300/15", violet: "text-violet-300 bg-violet-300/8 border-violet-300/15", amber: "text-amber-300 bg-amber-300/8 border-amber-300/15" };
  return (
    <div className="rounded-xl border border-white/10 bg-[#091722]/85 p-4">
      <div className="flex items-start justify-between"><p className="text-xs uppercase tracking-[0.1em] text-slate-500">{label}</p><span className={`grid size-8 place-items-center rounded-lg border ${colors[accent]}`}><Icon className="size-4" /></span></div>
      <p className="mt-3 font-mono text-xl font-semibold tracking-tight text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-xl border border-white/10 bg-[#091722]/85 p-4 sm:p-5">
      <h2 className="font-semibold text-white">{title}</h2>
      <p className="mb-4 mt-1 text-xs text-slate-500">{subtitle}</p>
      {children}
    </section>
  );
}
