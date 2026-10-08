export type Deployment = "Bare Metal" | "Docker" | "Kubernetes";
export type NetworkCondition = "Clean LAN" | "Typical DC" | "Congested";

export type LabConfig = {
  clients: number;
  rps: number;
  tlsOverheadMs: number;
  cores: number;
  network: NetworkCondition;
};

export type Result = {
  deployment: Deployment;
  throughput: number;
  p50: number;
  p95: number;
  p99: number;
  cpu: number;
  failed: number;
  capacity: number;
  bottleneck: string;
  queryCpu: number;
  keyCpu: number;
};

export const deployments: Deployment[] = ["Bare Metal", "Docker", "Kubernetes"];

const profiles = {
  "Bare Metal": { capacity: 33000, latency: 0.18, tls: 470, jitter: 1, color: "#36e3ff" },
  Docker: { capacity: 29800, latency: 0.23, tls: 420, jitter: 1.18, color: "#a78bfa" },
  Kubernetes: { capacity: 26100, latency: 0.31, tls: 365, jitter: 1.42, color: "#f4b860" },
} as const;

const networks: Record<NetworkCondition, { latency: number; capacity: number; jitter: number }> = {
  "Clean LAN": { latency: 0.08, capacity: 1, jitter: 0.85 },
  "Typical DC": { latency: 0.22, capacity: 0.92, jitter: 1.2 },
  Congested: { latency: 0.72, capacity: 0.68, jitter: 2.4 },
};

export const deploymentColor = (deployment: Deployment) => profiles[deployment].color;

export function simulate(config: LabConfig, deployment: Deployment): Result {
  const profile = profiles[deployment];
  const network = networks[config.network];
  const handshakesPerSecond = config.clients / 900;
  const keyCpu = (handshakesPerSecond / (profile.tls * config.cores)) * (1 + config.tlsOverheadMs / 4) * 100;
  const queryCapacity = profile.capacity * config.cores * network.capacity;
  const keyCapacityTax = Math.min(0.32, keyCpu / 160);
  const capacity = queryCapacity * (1 - keyCapacityTax);
  const throughput = Math.min(config.rps, capacity);
  const queryCpu = (throughput / queryCapacity) * 100;
  const cpu = Math.min(100, queryCpu + keyCpu);
  const saturation = Math.min(1.35, config.rps / Math.max(capacity, 1));
  const queue = saturation < 0.72 ? 0 : Math.pow((saturation - 0.72) * 5.4, 2);
  const p50 = profile.latency + network.latency + queue * 0.14;
  const p95 = p50 * (1.52 + profile.jitter * network.jitter * 0.16) + queue * 0.38;
  const p99 = p95 * (1.31 + profile.jitter * network.jitter * 0.1) + queue * 0.78;
  const droppedPerSecond = Math.max(0, config.rps - throughput);
  const failed = Math.round(droppedPerSecond * 60 + (cpu > 97 ? throughput * 0.0006 * 60 : 0));
  const bottleneck = cpu > 94
    ? keyCpu > queryCpu * 0.32
      ? "Crypto / CPU"
      : "CPU saturation"
    : saturation > 0.9
      ? "Packet path"
      : config.network === "Congested"
        ? "Network jitter"
        : "Headroom available";

  return {
    deployment,
    throughput: Math.round(throughput),
    p50: Number(p50.toFixed(2)),
    p95: Number(p95.toFixed(2)),
    p99: Number(p99.toFixed(2)),
    cpu: Number(cpu.toFixed(1)),
    failed,
    capacity: Math.round(capacity),
    bottleneck,
    queryCpu: Number(queryCpu.toFixed(1)),
    keyCpu: Number(keyCpu.toFixed(1)),
  };
}

export function makeLoadSeries(config: LabConfig) {
  const points = [0.2, 0.4, 0.6, 0.8, 1, 1.15, 1.3];
  return points.map((factor) => {
    const rps = Math.round(config.rps * factor);
    const row: Record<string, number> = { rps };
    deployments.forEach((deployment) => {
      const result = simulate({ ...config, rps }, deployment);
      row[`${deployment}-p99`] = result.p99;
      row[`${deployment}-throughput`] = result.throughput;
    });
    return row;
  });
}

export const defaultConfig: LabConfig = {
  clients: 24000,
  rps: 72000,
  tlsOverheadMs: 3.2,
  cores: 4,
  network: "Typical DC",
};

export const formatCompact = (value: number) =>
  new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
