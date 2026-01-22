/**
 * Thumbnail Processing State Tracker
 * 
 * Tracks which files are currently having thumbnails generated
 * Allows UI components to show processing indicators
 */

// Set of file IDs currently being processed
const processingFiles = new Set<string>();

// Listeners for state changes
type ProcessingListener = (fileId: string, isProcessing: boolean) => void;
const listeners = new Set<ProcessingListener>();

/**
 * Mark a file as processing thumbnail
 */
export function startThumbnailProcessing(fileId: string): void {
  processingFiles.add(fileId);
  notifyListeners(fileId, true);
}

/**
 * Mark a file as finished processing
 */
export function finishThumbnailProcessing(fileId: string): void {
  processingFiles.delete(fileId);
  notifyListeners(fileId, false);
}

/**
 * Check if a file is currently processing
 */
export function isProcessingThumbnail(fileId: string): boolean {
  return processingFiles.has(fileId);
}

/**
 * Get all currently processing file IDs
 */
export function getProcessingFiles(): string[] {
  return Array.from(processingFiles);
}

/**
 * Subscribe to processing state changes
 */
export function subscribeToProcessing(listener: ProcessingListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Notify all listeners of state change
 */
function notifyListeners(fileId: string, isProcessing: boolean): void {
  listeners.forEach(listener => listener(fileId, isProcessing));
}
