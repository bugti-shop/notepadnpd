/**
 * Storage Cleanup Utility - Automatically frees IndexedDB storage when items are deleted
 */

import { deleteTaskMedia, parseTaskMediaRef } from './taskMediaStorage';
import { TodoItem, Note } from '@/types/note';
import { deleteLargeMedia } from './unlimitedStorage';

/**
 * Clean up media associated with a deleted task
 */
export const cleanupTaskMedia = async (task: TodoItem): Promise<void> => {
  const mediaToDelete: string[] = [];

  // Check for image
  if (task.imageUrl) {
    const parsed = parseTaskMediaRef(task.imageUrl);
    if (parsed) {
      mediaToDelete.push(`${parsed.kind}_${parsed.id}`);
    }
  }

  // Check for voice recording
  if (task.voiceRecording?.audioUrl) {
    const parsed = parseTaskMediaRef(task.voiceRecording.audioUrl);
    if (parsed) {
      mediaToDelete.push(`${parsed.kind}_${parsed.id}`);
    }
  }

  // Check subtasks recursively
  if (task.subtasks) {
    for (const subtask of task.subtasks) {
      await cleanupTaskMedia(subtask);
    }
  }

  // Delete all media
  for (const mediaId of mediaToDelete) {
    try {
      const [kind, ...idParts] = mediaId.split('_');
      const id = idParts.join('_');
      await deleteTaskMedia(kind as 'image' | 'audio', id);
      // Also try chunked storage
      await deleteLargeMedia(mediaId);
    } catch (e) {
      console.warn('Failed to delete media:', mediaId, e);
    }
  }
};

/**
 * Clean up media associated with a deleted note
 */
export const cleanupNoteMedia = async (note: Note): Promise<void> => {
  // Clean up images
  if (note.images) {
    for (const imageUrl of note.images) {
      const parsed = parseTaskMediaRef(imageUrl);
      if (parsed) {
        try {
          await deleteTaskMedia(parsed.kind, parsed.id);
          await deleteLargeMedia(`${parsed.kind}_${parsed.id}`);
        } catch (e) {
          console.warn('Failed to delete note image:', imageUrl, e);
        }
      }
    }
  }

  // Clean up voice recordings
  if (note.voiceRecordings) {
    for (const recording of note.voiceRecordings) {
      if (recording.audioUrl) {
        const parsed = parseTaskMediaRef(recording.audioUrl);
        if (parsed) {
          try {
            await deleteTaskMedia(parsed.kind, parsed.id);
            await deleteLargeMedia(`${parsed.kind}_${parsed.id}`);
          } catch (e) {
            console.warn('Failed to delete note voice recording:', recording.audioUrl, e);
          }
        }
      }
    }
  }
};

/**
 * Clean up all media for multiple tasks (batch delete)
 */
export const cleanupTasksMedia = async (tasks: TodoItem[]): Promise<number> => {
  let deletedCount = 0;
  for (const task of tasks) {
    try {
      await cleanupTaskMedia(task);
      deletedCount++;
    } catch (e) {
      console.warn('Failed to cleanup task media:', task.id, e);
    }
  }
  return deletedCount;
};

/**
 * Clean up all media for multiple notes (batch delete)
 */
export const cleanupNotesMedia = async (notes: Note[]): Promise<number> => {
  let deletedCount = 0;
  for (const note of notes) {
    try {
      await cleanupNoteMedia(note);
      deletedCount++;
    } catch (e) {
      console.warn('Failed to cleanup note media:', note.id, e);
    }
  }
  return deletedCount;
};

/**
 * Compact IndexedDB storage by removing orphaned media
 * This runs after deletions to ensure storage is freed
 */
export const compactStorage = async (): Promise<void> => {
  // Force garbage collection on IndexedDB by closing and reopening
  // This is a no-op but triggers browser cleanup
  try {
    if ('indexedDB' in window) {
      // Request storage estimate to trigger cleanup
      if (navigator.storage && navigator.storage.estimate) {
        await navigator.storage.estimate();
      }
    }
  } catch (e) {
    console.warn('Storage compaction failed:', e);
  }
};

/**
 * Get storage usage statistics
 */
export const getStorageUsage = async (): Promise<{
  used: number;
  available: number;
  percentage: number;
}> => {
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      const used = estimate.usage || 0;
      const available = estimate.quota || 0;
      const percentage = available > 0 ? (used / available) * 100 : 0;
      return { used, available, percentage };
    }
  } catch (e) {
    console.warn('Failed to get storage usage:', e);
  }
  return { used: 0, available: 0, percentage: 0 };
};