import { useRef } from 'react';
import { cn } from '@/lib/utils';
import { 
  Pen, 
  Eraser, 
  Type, 
  Square, 
  Circle, 
  Minus, 
  Triangle, 
  MoveRight, 
  Star,
  Pentagon,
  Hexagon,
  Octagon,
  Diamond,
  Heart,
  Undo2,
  Redo2,
  Trash2,
  Move,
  Palette,
  PaintBucket
} from 'lucide-react';

export type SketchTool = 
  | 'pen' 
  | 'eraser' 
  | 'text'
  | 'rectangle' 
  | 'circle' 
  | 'line' 
  | 'triangle' 
  | 'arrow' 
  | 'star' 
  | 'pentagon'
  | 'hexagon' 
  | 'octagon' 
  | 'diamond' 
  | 'heart'
  | 'move';

interface SketchToolbarProps {
  currentTool: SketchTool;
  onToolSelect: (tool: SketchTool) => void;
  currentColor: string;
  onColorSelect: (color: string) => void;
  brushSize: number;
  onBrushSizeSelect: (size: number) => void;
  fillEnabled: boolean;
  onFillToggle: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
}

const TOOLS: { id: SketchTool; icon: React.ElementType; label: string }[] = [
  { id: 'pen', icon: Pen, label: 'Pen' },
  { id: 'eraser', icon: Eraser, label: 'Eraser' },
  { id: 'move', icon: Move, label: 'Move Shape' },
  { id: 'text', icon: Type, label: 'Text' },
  { id: 'rectangle', icon: Square, label: 'Rectangle' },
  { id: 'circle', icon: Circle, label: 'Circle' },
  { id: 'line', icon: Minus, label: 'Line' },
  { id: 'triangle', icon: Triangle, label: 'Triangle' },
  { id: 'arrow', icon: MoveRight, label: 'Arrow' },
  { id: 'star', icon: Star, label: 'Star' },
  { id: 'pentagon', icon: Pentagon, label: 'Pentagon' },
  { id: 'hexagon', icon: Hexagon, label: 'Hexagon' },
  { id: 'octagon', icon: Octagon, label: 'Octagon' },
  { id: 'diamond', icon: Diamond, label: 'Diamond' },
  { id: 'heart', icon: Heart, label: 'Heart' },
];

const COLORS = [
  '#000000', // Black
  '#FFFFFF', // White
  '#FF0000', // Red
  '#0000FF', // Blue
  '#00FF00', // Green
  '#FFFF00', // Yellow
  '#FF00FF', // Magenta
  '#00FFFF', // Cyan
  '#FFA500', // Orange
  '#800080', // Purple
  '#FFC0CB', // Pink
  '#A52A2A', // Brown
];

const BRUSH_SIZES = [2, 5, 10, 15];

export const SketchToolbar = ({
  currentTool,
  onToolSelect,
  currentColor,
  onColorSelect,
  brushSize,
  onBrushSizeSelect,
  fillEnabled,
  onFillToggle,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClear,
}: SketchToolbarProps) => {
  const colorInputRef = useRef<HTMLInputElement>(null);

  const handleColorPickerClick = () => {
    colorInputRef.current?.click();
  };

  return (
    <div className="flex items-center overflow-x-auto bg-background border-b px-2 py-2 gap-1.5 scrollbar-hide">
      {/* Tools */}
      {TOOLS.map((tool) => {
        const Icon = tool.icon;
        const isActive = currentTool === tool.id;
        return (
          <button
            key={tool.id}
            onClick={() => onToolSelect(tool.id)}
            className={cn(
              "flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all",
              isActive 
                ? "bg-primary text-primary-foreground shadow-md" 
                : "bg-muted/50 text-foreground hover:bg-muted border border-border"
            )}
            title={tool.label}
          >
            <Icon className="h-5 w-5" />
          </button>
        );
      })}

      {/* Separator */}
      <div className="w-px h-8 bg-border mx-1 flex-shrink-0" />

      {/* Fill Toggle */}
      <button
        onClick={onFillToggle}
        className={cn(
          "flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all",
          fillEnabled 
            ? "bg-accent text-accent-foreground shadow-md" 
            : "bg-muted/50 text-foreground hover:bg-muted border border-border"
        )}
        title={fillEnabled ? "Fill: ON" : "Fill: OFF"}
      >
        <PaintBucket className="h-5 w-5" />
      </button>

      {/* Separator */}
      <div className="w-px h-8 bg-border mx-1 flex-shrink-0" />

      {/* Brush Sizes */}
      {BRUSH_SIZES.map((size) => {
        const isActive = brushSize === size;
        const dotSize = 4 + (size * 1.2);
        return (
          <button
            key={size}
            onClick={() => onBrushSizeSelect(size)}
            className={cn(
              "flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all border",
              isActive 
                ? "bg-primary text-primary-foreground shadow-md border-primary" 
                : "bg-muted/50 hover:bg-muted border-border"
            )}
            title={`Size ${size}`}
          >
            <div 
              className={cn(
                "rounded-full",
                isActive ? "bg-primary-foreground" : "bg-foreground"
              )}
              style={{ width: dotSize, height: dotSize }}
            />
          </button>
        );
      })}

      {/* Separator */}
      <div className="w-px h-8 bg-border mx-1 flex-shrink-0" />

      {/* Colors */}
      {COLORS.map((color) => {
        const isActive = currentColor === color;
        return (
          <button
            key={color}
            onClick={() => onColorSelect(color)}
            className={cn(
              "flex-shrink-0 w-9 h-9 rounded-full transition-all border",
              isActive ? "ring-2 ring-offset-2 ring-primary scale-110" : "ring-0",
              color === '#FFFFFF' ? "border-border" : "border-transparent"
            )}
            style={{ backgroundColor: color }}
            title={color}
          />
        );
      })}

      {/* Color Picker */}
      <button
        onClick={handleColorPickerClick}
        className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all border border-border bg-gradient-to-br from-red-500 via-green-500 to-blue-500 hover:scale-105"
        title="Color Picker"
      >
        <Palette className="h-5 w-5 text-white drop-shadow-md" />
      </button>
      <input
        ref={colorInputRef}
        type="color"
        value={currentColor}
        onChange={(e) => onColorSelect(e.target.value)}
        className="hidden"
      />

      {/* Current Color Indicator */}
      <div
        className="flex-shrink-0 w-9 h-9 rounded-full border-2 border-foreground/30"
        style={{ backgroundColor: currentColor }}
        title={`Current: ${currentColor}`}
      />

      {/* Separator */}
      <div className="w-px h-8 bg-border mx-1 flex-shrink-0" />

      {/* Undo */}
      <button
        onClick={onUndo}
        disabled={!canUndo}
        className={cn(
          "flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all border border-border",
          canUndo 
            ? "bg-muted/50 text-foreground hover:bg-muted" 
            : "bg-muted/20 text-muted-foreground cursor-not-allowed"
        )}
        title="Undo"
      >
        <Undo2 className="h-5 w-5" />
      </button>

      {/* Redo */}
      <button
        onClick={onRedo}
        disabled={!canRedo}
        className={cn(
          "flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all border border-border",
          canRedo 
            ? "bg-muted/50 text-foreground hover:bg-muted" 
            : "bg-muted/20 text-muted-foreground cursor-not-allowed"
        )}
        title="Redo"
      >
        <Redo2 className="h-5 w-5" />
      </button>

      {/* Separator */}
      <div className="w-px h-8 bg-border mx-1 flex-shrink-0" />

      {/* Clear/Delete */}
      <button
        onClick={onClear}
        className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all border border-border bg-muted/50 text-destructive hover:bg-destructive/10"
        title="Clear Canvas"
      >
        <Trash2 className="h-5 w-5" />
      </button>
    </div>
  );
};
