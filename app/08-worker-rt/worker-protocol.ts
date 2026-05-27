/** Serializable rows — workers cannot send class instances to main. */
export type LevelRow = { price: string; size: string };

export type BookSnapshot = {
  bids: LevelRow[];
  asks: LevelRow[];
  spread: string | null;
  wsMessages: number;
  workerJobs: number;
};

/** Main thread → Worker */
export type MainToWorker =
  | { type: "WS_L2"; data: unknown }
  | { type: "FLOOD"; count: number }
  | { type: "RESET" };

/** Worker → Main thread */
export type WorkerToMain =
  | { type: "SNAPSHOT"; snapshot: BookSnapshot }
  | { type: "ERROR"; message: string };

export function emptySnapshot(): BookSnapshot {
  return {
    bids: [],
    asks: [],
    spread: null,
    wsMessages: 0,
    workerJobs: 0,
  };
}
