import { useState, useRef, useEffect } from 'react';
import { Note } from '@/types/note';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, Edit, Mic, FileText, Pen, Pin, FileCode, GitBranch, AlignLeft, Archive, Star, Check, Copy, EyeOff, Shield, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { getNoteProtection, NoteProtection } from '@/utils/noteProtection';
import { getSetting } from '@/utils/settingsStorage';
import { logActivity } from '@/utils/activityLogger';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface NoteCardProps {
  note: Note;
  onEdit: (note: Note) => void;
  onDelete: (id: string) => void;
  onArchive?: (id: string) => void;
  onTogglePin?: (noteId: string, e: React.MouseEvent) => void;
  onToggleFavorite?: (noteId: string) => void;
  onDragStart?: (e: React.DragEvent, noteId: string) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent, targetNoteId: string) => void;
  onDragEnd?: () => void;
  // Selection mode props
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (noteId: string) => void;
  // Duplicate
  onDuplicate?: (noteId: string) => void;
  // Hide/Protect
  onHide?: (noteId: string) => void;
  onProtect?: (noteId: string) => void;
}

const STICKY_COLORS = {
  yellow: 'hsl(var(--sticky-yellow))',
  blue: 'hsl(var(--sticky-blue))',
  green: 'hsl(var(--sticky-green))',
  pink: 'hsl(var(--sticky-pink))',
  orange: 'hsl(var(--sticky-orange))',
};

const RANDOM_COLORS = [
  'hsl(330, 100%, 75%)',
  'hsl(160, 70%, 70%)',
  'hsl(280, 70%, 75%)',
  'hsl(20, 95%, 75%)',
  'hsl(140, 65%, 70%)',
  'hsl(350, 80%, 75%)',
  'hsl(45, 90%, 75%)',
  'hsl(270, 65%, 75%)',
  'hsl(200, 80%, 70%)',
  'hsl(60, 90%, 75%)',
];

export const NoteCard = ({ note, onEdit, onDelete, onArchive, onTogglePin, onToggleFavorite, onDragStart, onDragOver, onDrop, onDragEnd, isSelectionMode = false, isSelected = false, onToggleSelection, onDuplicate, onHide, onProtect }: NoteCardProps) => {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [noteProtection, setNoteProtection] = useState<NoteProtection>({ hasPassword: false, useBiometric: false });
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPress = useRef(false);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const swipeStartX = useRef<number | null>(null);

  // Load protection status async
  useEffect(() => {
    getNoteProtection(note.id).then(setNoteProtection);
  }, [note.id]);

  const isSticky = note.type === 'sticky';
  const isLined = note.type === 'lined';
  const isSketch = note.type === 'sketch';
  const isCode = note.type === 'code';
  const SWIPE_THRESHOLD = 80;

  const getHapticStyle = () => {
    // Default intensity, actual value is loaded from IndexedDB on app init
    const intensity: string = 'medium';
    switch (intensity) {
      case 'off': return null;
      case 'light': return ImpactStyle.Light;
      case 'heavy': return ImpactStyle.Heavy;
      default: return ImpactStyle.Medium;
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    isLongPress.current = false;
    const touchX = e.touches[0].clientX;
    const touchY = e.touches[0].clientY;
    touchStartPos.current = { x: touchX, y: touchY };
    swipeStartX.current = touchX;
    
    longPressTimerRef.current = setTimeout(async () => {
      if (!isSwiping) {
        isLongPress.current = true;
        const hapticStyle = getHapticStyle();
        if (hapticStyle) {
          try {
            await Haptics.impact({ style: hapticStyle });
          } catch (error) {
            console.log('Haptics not available');
          }
        }
        setShowContextMenu(true);
      }
    }, 500);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPos.current || !swipeStartX.current) return;
    
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - swipeStartX.current;
    const deltaY = Math.abs(currentY - touchStartPos.current.y);
    
    // If vertical movement is greater, don't swipe (user is scrolling)
    if (deltaY > 30 && !isSwiping) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      return;
    }
    
    // Start swiping if horizontal movement exceeds threshold
    if (Math.abs(deltaX) > 15) {
      setIsSwiping(true);
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      // Limit swipe distance
      const maxSwipe = 120;
      setSwipeOffset(Math.max(-maxSwipe, Math.min(maxSwipe, deltaX)));
    }
  };

  const handleTouchEnd = async () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    
    if (isSwiping) {
      const hapticStyle = getHapticStyle();
      // Right swipe - Favorite
      if (swipeOffset > SWIPE_THRESHOLD && onToggleFavorite) {
        if (hapticStyle) {
          try {
            await Haptics.impact({ style: hapticStyle });
          } catch (error) {}
        }
        onToggleFavorite(note.id);
      }
      // Left swipe - Archive/Delete
      else if (swipeOffset < -SWIPE_THRESHOLD) {
        if (hapticStyle) {
          try {
            await Haptics.impact({ style: hapticStyle });
          } catch (error) {}
        }
        if (onArchive) {
          onArchive(note.id);
        } else {
          onDelete(note.id);
        }
      }
    }
    
    setSwipeOffset(0);
    setIsSwiping(false);
    touchStartPos.current = null;
    swipeStartX.current = null;
  };

  const handleClick = () => {
    if (isSelectionMode && onToggleSelection) {
      onToggleSelection(note.id);
      return;
    }
    if (!isLongPress.current && !showContextMenu && !isSwiping) {
      onEdit(note);
    }
  };

  const getCardColor = () => {
    if (isSticky && note.color) {
      return STICKY_COLORS[note.color];
    }
    const index = note.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return RANDOM_COLORS[index % RANDOM_COLORS.length];
  };

  const cardStyle = { backgroundColor: getCardColor() };

  const getTypeBadge = () => {
    // Check for voice note type first
    if (note.type === 'voice') {
      return { icon: Mic, label: 'Voice' };
    }
    // Also show mic badge if any voice recordings exist
    if (note.voiceRecordings && note.voiceRecordings.length > 0) {
      return { icon: Mic, label: 'Audio File' };
    }
    switch (note.type) {
      case 'lined':
        return { icon: AlignLeft, label: 'Lined' };
      case 'sketch':
        return { icon: Pen, label: 'Sketch' };
      case 'code':
        return { icon: FileCode, label: 'Code' };
      default:
        return { icon: FileText, label: 'Text' };
    }
  };

  const badge = getTypeBadge();
  const BadgeIcon = badge.icon;

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* Swipe action backgrounds */}
      <div className="absolute inset-0 flex">
        {/* Left side - Favorite (swipe right reveals) */}
        <div 
          className={cn(
            "flex items-center justify-start pl-4 w-1/2 transition-opacity",
            swipeOffset > 30 ? "bg-yellow-500" : "bg-yellow-400"
          )}
          style={{ opacity: Math.min(1, swipeOffset / SWIPE_THRESHOLD) }}
        >
          <Star className={cn("h-6 w-6 text-white", swipeOffset > SWIPE_THRESHOLD && "fill-white")} />
        </div>
        {/* Right side - Archive/Delete (swipe left reveals) */}
        <div 
          className={cn(
            "flex items-center justify-end pr-4 w-1/2 transition-opacity",
            swipeOffset < -30 ? "bg-red-500" : "bg-red-400"
          )}
          style={{ opacity: Math.min(1, Math.abs(swipeOffset) / SWIPE_THRESHOLD) }}
        >
          {onArchive ? <Archive className="h-6 w-6 text-white" /> : <Trash2 className="h-6 w-6 text-white" />}
        </div>
      </div>

      <Card
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        draggable={!!onDragStart}
        onDragStart={onDragStart ? (e) => onDragStart(e, note.id) : undefined}
        onDragOver={onDragOver}
        onDrop={onDrop ? (e) => onDrop(e, note.id) : undefined}
        onDragEnd={onDragEnd}
        className={cn(
          'group relative overflow-hidden cursor-pointer',
          'w-full hover:shadow-md border border-border/50',
          isSwiping ? '' : 'transition-transform duration-200',
          isSelected && 'ring-2 ring-primary ring-offset-2'
        )}
        style={{ 
          ...cardStyle,
          transform: `translateX(${swipeOffset}px)`,
        }}
      >
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            {/* Selection checkbox */}
            {isSelectionMode && (
              <div 
                className={cn(
                  "h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 mr-2",
                  isSelected ? "bg-primary border-primary" : "border-black/40 bg-white/50"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelection?.(note.id);
                }}
              >
                {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
              </div>
            )}
          {note.title && (
              <h3 className="font-semibold text-base line-clamp-1 text-black flex-1">{note.title}</h3>
            )}
            {note.isFavorite && (
              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 shrink-0" />
            )}
            {(noteProtection.hasPassword || noteProtection.useBiometric) && (
              <Lock className="h-4 w-4 text-primary shrink-0" />
            )}
          </div>

          {/* Show metaDescription if available, otherwise show content preview */}
          {(note.metaDescription || note.content) && (
            <p className="text-sm text-black/70 mb-3 line-clamp-2 transition-all duration-300">
              {note.metaDescription || note.content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()}
            </p>
          )}

          <div className="flex items-center justify-between gap-2 text-xs text-black/60">
            <span>
              {new Date(note.updatedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
              })} • {new Date(note.updatedAt).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              })}
            </span>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white text-xs font-medium text-black">
              <BadgeIcon className="h-3 w-3" />
              <span>{badge.label}</span>
            </div>
          </div>
        </div>
      </Card>

      <DropdownMenu open={showContextMenu} onOpenChange={setShowContextMenu}>
        <DropdownMenuTrigger asChild>
          <span className="sr-only">Open menu</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-48 z-50 bg-background border border-border shadow-lg">
          <DropdownMenuItem onClick={() => { setShowContextMenu(false); onEdit(note); }} className="gap-2">
            <Edit className="h-4 w-4" />
            Edit
          </DropdownMenuItem>
          {onTogglePin && (
            <DropdownMenuItem onClick={(e) => { setShowContextMenu(false); onTogglePin(note.id, e as any); }} className="gap-2">
              <Pin className={cn("h-4 w-4", note.isPinned && "fill-current")} />
              {note.isPinned ? 'Unpin' : 'Pin'}
            </DropdownMenuItem>
          )}
          {onToggleFavorite && (
            <DropdownMenuItem onClick={() => { setShowContextMenu(false); onToggleFavorite(note.id); }} className="gap-2">
              <Star className={cn("h-4 w-4", note.isFavorite && "fill-yellow-400 text-yellow-400")} />
              {note.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
            </DropdownMenuItem>
          )}
          {onArchive && (
            <DropdownMenuItem onClick={() => { setShowContextMenu(false); onArchive(note.id); }} className="gap-2">
              <Archive className="h-4 w-4" />
              Archive
            </DropdownMenuItem>
          )}
          {onDuplicate && (
            <DropdownMenuItem onClick={() => { setShowContextMenu(false); onDuplicate(note.id); }} className="gap-2">
              <Copy className="h-4 w-4" />
              Duplicate
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {onHide && (
            <DropdownMenuItem onClick={() => { setShowContextMenu(false); onHide(note.id); }} className="gap-2">
              <EyeOff className="h-4 w-4" />
              Hide Note
            </DropdownMenuItem>
          )}
          {onProtect && (
            <DropdownMenuItem onClick={() => { setShowContextMenu(false); onProtect(note.id); }} className="gap-2">
              <Shield className="h-4 w-4" />
              {noteProtection.hasPassword || noteProtection.useBiometric ? 'Change Protection' : 'Protect Note'}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => { setShowContextMenu(false); onDelete(note.id); }} className="gap-2 text-destructive">
            <Trash2 className="h-4 w-4" />
            Move to Trash
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
