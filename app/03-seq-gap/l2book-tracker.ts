export type Anomaly =
  | { type: "TIME_REGRESSION"; prev: number; cur: number; at: number }
  | { type: "LONG_GAP"; gapMs: number; at: number };

export type TrackerStats = {
  processed: number;
  regressions: number;
  longGaps: number;
  lastTime: number | null;
};

export class L2BookTracker {
  private lastTime: number | null = null;

  private processed = 0;
  private regressions = 0;
  private longGaps = 0;
  private anomalies: Anomaly[] = [];

  observe(messageTime: number): Anomaly | null {
    this.processed += 1;

    let anomaly: Anomaly | null = null;

    if (this.lastTime !== null) {
      if (messageTime < this.lastTime) {
        anomaly = {
          type: "TIME_REGRESSION",
          prev: this.lastTime,
          cur: messageTime,
          at: Date.now(),
        };
        this.regressions += 1;
      } else if (messageTime - this.lastTime > 5000) {
        anomaly = {
          type: "LONG_GAP",
          gapMs: messageTime - this.lastTime,
          at: messageTime,
        };
        this.longGaps += 1;
      }
    }

    this.lastTime = messageTime;
    if (anomaly) {
      this.anomalies.push(anomaly);
      if (this.anomalies.length > 200) this.anomalies.shift();
    }
    return anomaly;
  }

  resetStream(): void {
    this.lastTime = null;
  } // current reset()
  resetAll(): void {
    this.resetStream();
    this.processed = this.regressions = this.longGaps = 0;
    this.anomalies = [];
  }

  getStats(): TrackerStats {
    return {
      processed: this.processed,
      regressions: this.regressions,
      longGaps: this.longGaps,
      lastTime: this.lastTime,
    };
  }

  recentAnomalies(limit = 20): Anomaly[] {
    return this.anomalies.slice(-limit);
  }
}
