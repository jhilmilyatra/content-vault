// Background job utilities for Edge Functions
// Use EdgeRuntime.waitUntil() for background tasks

export interface BackgroundJob {
  id: string;
  type: string;
  status: "pending" | "processing" | "completed" | "failed";
  createdAt: number;
  data: unknown;
}

// Job queue (in-memory, resets on cold start)
// For production, use Supabase table or Redis
const jobQueue = new Map<string, BackgroundJob>();

export function createJobId(): string {
  return crypto.randomUUID();
}

export function queueBackgroundJob(
  type: string,
  data: unknown
): string {
  const id = createJobId();
  const job: BackgroundJob = {
    id,
    type,
    status: "pending",
    createdAt: Date.now(),
    data,
  };
  jobQueue.set(id, job);
  console.log(`📋 Queued background job: ${type} (${id})`);
  return id;
}

export function getJobStatus(id: string): BackgroundJob | undefined {
  return jobQueue.get(id);
}

export function updateJobStatus(
  id: string,
  status: BackgroundJob["status"],
  result?: unknown
): void {
  const job = jobQueue.get(id);
  if (job) {
    job.status = status;
    if (result) {
      (job as BackgroundJob & { result: unknown }).result = result;
    }
    console.log(`📋 Job ${id} status: ${status}`);
  }
}

// Cleanup old jobs periodically
export function cleanupOldJobs(maxAgeMs = 3600000): void {
  const now = Date.now();
  for (const [id, job] of jobQueue.entries()) {
    if (now - job.createdAt > maxAgeMs) {
      jobQueue.delete(id);
    }
  }
}

// Background task wrapper with error handling
export async function runBackgroundTask<T>(
  taskName: string,
  task: () => Promise<T>
): Promise<T | null> {
  const startTime = Date.now();
  try {
    const result = await task();
    console.log(`✓ Background task ${taskName} completed in ${Date.now() - startTime}ms`);
    return result;
  } catch (error) {
    console.error(`✗ Background task ${taskName} failed:`, error);
    return null;
  }
}

// Batch processor for heavy operations
export async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options: { concurrency?: number; onProgress?: (completed: number, total: number) => void } = {}
): Promise<R[]> {
  const { concurrency = 3, onProgress } = options;
  const results: R[] = [];
  let completed = 0;

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
    completed += batch.length;
    onProgress?.(completed, items.length);
  }

  return results;
}
