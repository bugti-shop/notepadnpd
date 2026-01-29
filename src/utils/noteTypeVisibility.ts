import { NoteType } from '@/types/note';
import { getSetting, setSetting } from './settingsStorage';

// All available note types
export const ALL_NOTE_TYPES: NoteType[] = ['regular', 'lined', 'sticky', 'code', 'sketch', 'voice'];

// Default: all note types are visible
const DEFAULT_VISIBLE_TYPES: NoteType[] = [...ALL_NOTE_TYPES];

const STORAGE_KEY = 'visible_note_types';

// Get the list of visible note types
export const getVisibleNoteTypes = async (): Promise<NoteType[]> => {
  const saved = await getSetting<NoteType[]>(STORAGE_KEY, DEFAULT_VISIBLE_TYPES);
  // Ensure at least one type is always visible
  if (!saved || saved.length === 0) {
    return DEFAULT_VISIBLE_TYPES;
  }
  return saved;
};

// Set the list of visible note types (must have at least 1)
export const setVisibleNoteTypes = async (types: NoteType[]): Promise<boolean> => {
  if (types.length === 0) {
    console.error('Cannot hide all note types - at least one must remain visible');
    return false;
  }
  await setSetting(STORAGE_KEY, types);
  // Dispatch event for real-time updates
  window.dispatchEvent(new CustomEvent('noteTypesVisibilityChanged', { detail: { types } }));
  return true;
};

// Toggle a single note type visibility
export const toggleNoteTypeVisibility = async (type: NoteType): Promise<{ success: boolean; visible: NoteType[] }> => {
  const currentVisible = await getVisibleNoteTypes();
  
  if (currentVisible.includes(type)) {
    // Trying to hide - check if it's the last one
    if (currentVisible.length === 1) {
      return { success: false, visible: currentVisible };
    }
    const newVisible = currentVisible.filter(t => t !== type);
    await setVisibleNoteTypes(newVisible);
    return { success: true, visible: newVisible };
  } else {
    // Show the type
    const newVisible = [...currentVisible, type];
    await setVisibleNoteTypes(newVisible);
    return { success: true, visible: newVisible };
  }
};

// Check if a note type is visible
export const isNoteTypeVisible = async (type: NoteType): Promise<boolean> => {
  const visible = await getVisibleNoteTypes();
  return visible.includes(type);
};

// Get display name for note type
export const getNoteTypeDisplayName = (type: NoteType): string => {
  const names: Record<NoteType, string> = {
    regular: 'Regular Note',
    lined: 'Lined Note',
    sticky: 'Sticky Note',
    code: 'Code Note',
    sketch: 'Sketch Note',
    voice: 'Voice Note',
  };
  return names[type] || type;
};

// Get icon name for note type (for use with lucide-react)
export const getNoteTypeIcon = (type: NoteType): string => {
  const icons: Record<NoteType, string> = {
    regular: 'FileText',
    lined: 'PenLine',
    sticky: 'StickyNote',
    code: 'Code',
    sketch: 'Brush',
    voice: 'Mic',
  };
  return icons[type] || 'FileText';
};
