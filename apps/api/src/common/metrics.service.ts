import { Injectable } from '@nestjs/common';
type Metric = { count: number; totalDurationMs: number };
@Injectable()
export class MetricsService { private readonly metrics = new Map<string, Metric>(); increment(name: string, durationMs = 0): void { const current = this.metrics.get(name) ?? { count: 0, totalDurationMs: 0 }; current.count += 1; current.totalDurationMs += Math.max(0, durationMs); this.metrics.set(name, current); } snapshot(): Record<string, Metric> { return Object.fromEntries([...this.metrics.entries()].map(([name, metric]) => [name, { ...metric }])); } }
