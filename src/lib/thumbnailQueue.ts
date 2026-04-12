/**
 * Thumbnail loading queue with concurrency control
 * Throttles concurrent thumbnail fetches based on network conditions
 */

type QueueItem = {
  url: string;
  resolve: (value: string | null) => void;
  reject: (reason: unknown) => void;
  priority: 'high' | 'normal' | 'low';
};

class ThumbnailQueue {
  private queue: QueueItem[] = [];
  private activeCount = 0;
  private maxConcurrency: number;

  constructor() {
    this.maxConcurrency = this.detectConcurrency();
  }

  private detectConcurrency(): number {
    const connection = (navigator as any).connection;
    if (connection?.effectiveType) {
      switch (connection.effectiveType) {
        case 'slow-2g':
        case '2g':
          return 2;
        case '3g':
          return 3;
        case '4g':
          return 6;
        default:
          return 4;
      }
    }
    // Check hardware concurrency
    const cores = navigator.hardwareConcurrency || 4;
    return Math.min(cores, 6);
  }

  /**
   * Enqueue a thumbnail fetch with priority
   */
  enqueue(url: string, priority: 'high' | 'normal' | 'low' = 'normal'): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const item: QueueItem = { url, resolve, reject, priority };

      // Insert based on priority
      if (priority === 'high') {
        // Find first non-high item and insert before it
        const idx = this.queue.findIndex(q => q.priority !== 'high');
        if (idx === -1) {
          this.queue.push(item);
        } else {
          this.queue.splice(idx, 0, item);
        }
      } else if (priority === 'low') {
        this.queue.push(item);
      } else {
        // Normal: insert after high items
        const idx = this.queue.findIndex(q => q.priority === 'low');
        if (idx === -1) {
          this.queue.push(item);
        } else {
          this.queue.splice(idx, 0, item);
        }
      }

      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    while (this.activeCount < this.maxConcurrency && this.queue.length > 0) {
      const item = this.queue.shift()!;
      this.activeCount++;

      this.fetchThumbnail(item.url)
        .then(item.resolve)
        .catch(item.reject)
        .finally(() => {
          this.activeCount--;
          this.processQueue();
        });
    }
  }

  private async fetchThumbnail(url: string): Promise<string | null> {
    try {
      const response = await fetch(url, {
        credentials: 'include',
        priority: 'low' as RequestPriority,
      });

      if (!response.ok) return null;

      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch {
      return null;
    }
  }

  /**
   * Cancel all pending items (useful on page navigation)
   */
  clear(): void {
    this.queue.forEach(item => item.resolve(null));
    this.queue = [];
  }

  get pending(): number {
    return this.queue.length;
  }

  get active(): number {
    return this.activeCount;
  }
}

// Singleton instance
export const thumbnailQueue = new ThumbnailQueue();

export default thumbnailQueue;
