export type WorkerConfig = {
  concurrency: number;
  maxStalledCount: number;
  stalledInterval: number;
  lockDuration: number;
};
