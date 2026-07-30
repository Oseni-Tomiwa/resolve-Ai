import { Injectable } from '@nestjs/common';

@Injectable()
export class RateLimitService {
  private readonly buckets = new Map<string, number[]>();

  allow(key: string, maximum: number, windowMs: number): boolean {
    const now = Date.now();
    const recent = (this.buckets.get(key) ?? []).filter((timestamp) => now - timestamp < windowMs);
    if (recent.length >= maximum) { this.buckets.set(key, recent); return false; }
    recent.push(now);
    this.buckets.set(key, recent);
    return true;
  }
}
