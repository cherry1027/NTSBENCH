# NTSBench

NTSBench is an interactive research prototype for exploring Network Time Security performance and resilience across bare-metal, Docker, and Kubernetes deployments.

It uses transparent, deterministic synthetic models. Results are simulations—not measured Netnod results or production benchmarks.

## Features

### Performance Lab

- Compare Bare Metal, Docker, and Kubernetes
- Configure clients, queries per second, CPU cores, TLS overhead, and network conditions
- Model NTS key establishment separately from NTP time queries
- Explore throughput, P50/P95/P99 latency, CPU utilization, failures, and bottlenecks
- Import real benchmark results from CSV
- Interactive Recharts visualizations

### Resilience Lab

- Interactive Kubernetes and NTS architecture diagram
- Simulate node failure, pod restart, CPU contention, and horizontal scaling
- Compare capacity, availability, recovery time, complexity, and performance
- Review optimization suggestions for CPU pinning, resource guarantees, networking, and pod placement
- Export a synthetic Markdown research report

## Important Modeling Assumption

TLS is used only during NTS key establishment. It is not modeled as running for every NTP time query.

The default model assumes each client establishes one new NTS session every 15 minutes. Subsequent time queries reuse NTS cookies.

## Tech Stack

- React
- TypeScript
- Tailwind CSS
- Lucide Icons
- Recharts
- Next.js-compatible application structure

## Run Locally

```bash
npm install
npm run dev
