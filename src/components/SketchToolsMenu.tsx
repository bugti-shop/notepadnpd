import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Grid3X3,
  MousePointer2,
  Move,
  PaintBucket,
  Ruler,
  Sparkles,
  Paintbrush,
  Spline,
  Waves,
  ImagePlus,
  Box,
  Type,
  Video,
  EyeOff,
  Square,
  Circle,
  Triangle,
  Star,
  Hexagon,
  Pentagon,
  Octagon,
  Diamond,
  Heart,
  Minus,
  MoveRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type DrawTool = 
  | 'pen' 
  | 'eraser' 
  | 'rectangle' 
  | 'circle' 
  | 'line' 
  | 'triangle' 
  | 'arrow' 
  | 'star' 
  | 'hexagon' 
  | 'pentagon' 
  | 'octagon' 
  | 'diamond' 
  | 'heart' 
  | 'text';

export type ToolMenuOption = 
  | 'selection'
  | 'transform'
  | 'fill'
  | 'guides'
  | 'symmetry'
  | 'drawStyles'
  | 'steadyStroke'
  | 'predictiveStroke'
  | 'importImage'
  | 'perspectiveGuides'
  | 'text'
  | 'timelapse'
  | 'autoHide';

export type SymmetryMode = 'vertical' | 'horizontal' | 'radial';

interface SketchToolsMenuProps {
  currentTool: DrawTool;
  onToolSelect: (tool: DrawTool) => void;
  fillEnabled: boolean;
  onFillToggle: () => void;
  symmetryEnabled: boolean;
  onSymmetryToggle: () => void;
  symmetryMode: SymmetryMode;
  onSymmetryModeChange: (mode: SymmetryMode) => void;
  steadyStrokeEnabled: boolean;
  onSteadyStrokeToggle: () => void;
  predictiveStrokeEnabled: boolean;
  onPredictiveStrokeToggle: () => void;
  guidesEnabled: boolean;
  onGuidesToggle: () => void;
  autoHideToolbar: boolean;
  onAutoHideToggle: () => void;
  onImportImage: () => void;
  onSelectionMode: () => void;
  onTransformMode: () => void;
}

const SHAPES = [
  { id: 'rectangle' as const, name: 'Rectangle', icon: Square },
  { id: 'circle' as const, name: 'Circle', icon: Circle },
  { id: 'triangle' as const, name: 'Triangle', icon: Triangle },
  { id: 'star' as const, name: 'Star', icon: Star },
  { id: 'hexagon' as const, name: 'Hexagon', icon: Hexagon },
  { id: 'pentagon' as const, name: 'Pentagon', icon: Pentagon },
  { id: 'octagon' as const, name: 'Octagon', icon: Octagon },
  { id: 'diamond' as const, name: 'Diamond', icon: Diamond },
  { id: 'heart' as const, name: 'Heart', icon: Heart },
  { id: 'line' as const, name: 'Line', icon: Minus },
  { id: 'arrow' as const, name: 'Arrow', icon: MoveRight },
];

export const SketchToolsMenu = ({
  currentTool,
  onToolSelect,
  fillEnabled,
  onFillToggle,
  symmetryEnabled,
  onSymmetryToggle,
  symmetryMode,
  onSymmetryModeChange,
  steadyStrokeEnabled,
  onSteadyStrokeToggle,
  predictiveStrokeEnabled,
  onPredictiveStrokeToggle,
  guidesEnabled,
  onGuidesToggle,
  autoHideToolbar,
  onAutoHideToggle,
  onImportImage,
  onSelectionMode,
  onTransformMode,
}: SketchToolsMenuProps) => {
  const [open, setOpen] = useState(false);

  const SYMMETRY_MODES: { value: SymmetryMode; label: string }[] = [
    { value: 'vertical', label: 'Vertical' },
    { value: 'horizontal', label: 'Horizontal' },
    { value: 'radial', label: 'Radial' },
  ];

  const isShapeTool = SHAPES.some(s => s.id === currentTool);
  const currentShape = SHAPES.find(s => s.id === currentTool);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="h-10 w-10 shrink-0">
          <Grid3X3 className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[280px] p-2" align="start">
        <div className="grid grid-cols-3 gap-1">
          {/* Selection */}
          <DropdownMenuItem
            className="flex flex-col items-center justify-center h-20 gap-1 cursor-pointer rounded-lg hover:bg-accent"
            onClick={() => {
              onSelectionMode();
              setOpen(false);
            }}
          >
            <div className="p-2 rounded-lg bg-background border">
              <MousePointer2 className="h-6 w-6" />
            </div>
            <span className="text-xs">Selection</span>
          </DropdownMenuItem>

          {/* Transform */}
          <DropdownMenuItem
            className="flex flex-col items-center justify-center h-20 gap-1 cursor-pointer rounded-lg hover:bg-accent"
            onClick={() => {
              onTransformMode();
              setOpen(false);
            }}
          >
            <div className="p-2 rounded-lg bg-background border">
              <Move className="h-6 w-6" />
            </div>
            <span className="text-xs">Transform</span>
          </DropdownMenuItem>

          {/* Fill */}
          <DropdownMenuItem
            className={cn(
              "flex flex-col items-center justify-center h-20 gap-1 cursor-pointer rounded-lg hover:bg-accent",
              fillEnabled && "bg-primary/10"
            )}
            onClick={() => {
              onFillToggle();
              setOpen(false);
            }}
          >
            <div className={cn("p-2 rounded-lg border", fillEnabled ? "bg-primary text-primary-foreground" : "bg-background")}>
              <PaintBucket className="h-6 w-6" />
            </div>
            <span className="text-xs">Fill</span>
          </DropdownMenuItem>

          {/* Guides */}
          <DropdownMenuItem
            className={cn(
              "flex flex-col items-center justify-center h-20 gap-1 cursor-pointer rounded-lg hover:bg-accent",
              guidesEnabled && "bg-primary/10"
            )}
            onClick={() => {
              onGuidesToggle();
              setOpen(false);
            }}
          >
            <div className={cn("p-2 rounded-lg border", guidesEnabled ? "bg-primary text-primary-foreground" : "bg-background")}>
              <Ruler className="h-6 w-6" />
            </div>
            <span className="text-xs">Guides</span>
          </DropdownMenuItem>

          {/* Symmetry - Submenu with modes */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger
              className={cn(
                "flex flex-col items-center justify-center h-20 gap-1 cursor-pointer rounded-lg hover:bg-accent",
                symmetryEnabled && "bg-primary/10"
              )}
            >
              <div className={cn("p-2 rounded-lg border", symmetryEnabled ? "bg-primary text-primary-foreground" : "bg-background")}>
                <Sparkles className="h-6 w-6" />
              </div>
              <span className="text-xs">Symmetry</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-[200px] p-2">
              <DropdownMenuItem
                className="flex items-center justify-between cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  onSymmetryToggle();
                }}
              >
                <span>Enable Symmetry</span>
                <div className={cn(
                  "w-4 h-4 rounded border-2",
                  symmetryEnabled ? "bg-primary border-primary" : "border-muted-foreground"
                )} />
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {SYMMETRY_MODES.map((mode) => (
                <DropdownMenuItem
                  key={mode.value}
                  className={cn(
                    "flex items-center justify-between cursor-pointer",
                    symmetryMode === mode.value && symmetryEnabled && "bg-primary/10"
                  )}
                  onClick={() => {
                    onSymmetryModeChange(mode.value);
                    if (!symmetryEnabled) onSymmetryToggle();
                  }}
                >
                  <span>{mode.label}</span>
                  {symmetryMode === mode.value && (
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {/* Draw Styles - Submenu with shapes */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger
              className={cn(
                "flex flex-col items-center justify-center h-20 gap-1 cursor-pointer rounded-lg hover:bg-accent",
                isShapeTool && "bg-primary/10"
              )}
            >
              <div className={cn("p-2 rounded-lg border", isShapeTool ? "bg-primary text-primary-foreground" : "bg-background")}>
                {currentShape ? <currentShape.icon className="h-6 w-6" /> : <Paintbrush className="h-6 w-6" />}
              </div>
              <span className="text-xs">Draw Styles</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-[280px] p-2">
              <div className="grid grid-cols-3 gap-1">
                {SHAPES.map((shape) => (
                  <DropdownMenuItem
                    key={shape.id}
                    className={cn(
                      "flex flex-col items-center justify-center h-20 gap-1 cursor-pointer rounded-lg hover:bg-accent",
                      currentTool === shape.id && "bg-primary/10"
                    )}
                    onClick={() => {
                      onToolSelect(shape.id);
                      setOpen(false);
                    }}
                  >
                    <div className={cn("p-2 rounded-lg border", currentTool === shape.id ? "bg-primary text-primary-foreground" : "bg-background")}>
                      <shape.icon className="h-6 w-6" />
                    </div>
                    <span className="text-xs">{shape.name}</span>
                  </DropdownMenuItem>
                ))}
              </div>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {/* Steady Stroke */}
          <DropdownMenuItem
            className={cn(
              "flex flex-col items-center justify-center h-20 gap-1 cursor-pointer rounded-lg hover:bg-accent",
              steadyStrokeEnabled && "bg-primary/10"
            )}
            onClick={() => {
              onSteadyStrokeToggle();
              setOpen(false);
            }}
          >
            <div className={cn("p-2 rounded-lg border", steadyStrokeEnabled ? "bg-primary text-primary-foreground" : "bg-background")}>
              <Spline className="h-6 w-6" />
            </div>
            <span className="text-xs text-center">Steady Stroke</span>
          </DropdownMenuItem>

          {/* Predictive Stroke */}
          <DropdownMenuItem
            className={cn(
              "flex flex-col items-center justify-center h-20 gap-1 cursor-pointer rounded-lg hover:bg-accent",
              predictiveStrokeEnabled && "bg-primary/10"
            )}
            onClick={() => {
              onPredictiveStrokeToggle();
              setOpen(false);
            }}
          >
            <div className={cn("p-2 rounded-lg border", predictiveStrokeEnabled ? "bg-primary text-primary-foreground" : "bg-background")}>
              <Waves className="h-6 w-6" />
            </div>
            <span className="text-xs text-center">Predictive Stroke</span>
          </DropdownMenuItem>

          {/* Import Image */}
          <DropdownMenuItem
            className="flex flex-col items-center justify-center h-20 gap-1 cursor-pointer rounded-lg hover:bg-accent"
            onClick={() => {
              onImportImage();
              setOpen(false);
            }}
          >
            <div className="p-2 rounded-lg bg-background border">
              <ImagePlus className="h-6 w-6" />
            </div>
            <span className="text-xs text-center">Import Image</span>
          </DropdownMenuItem>

          {/* Perspective Guides */}
          <DropdownMenuItem
            className="flex flex-col items-center justify-center h-20 gap-1 cursor-pointer rounded-lg hover:bg-accent"
            onClick={() => setOpen(false)}
          >
            <div className="p-2 rounded-lg bg-background border">
              <Box className="h-6 w-6" />
            </div>
            <span className="text-xs text-center">Perspective Guides</span>
          </DropdownMenuItem>

          {/* Text */}
          <DropdownMenuItem
            className={cn(
              "flex flex-col items-center justify-center h-20 gap-1 cursor-pointer rounded-lg hover:bg-accent",
              currentTool === 'text' && "bg-primary/10"
            )}
            onClick={() => {
              onToolSelect('text');
              setOpen(false);
            }}
          >
            <div className={cn("p-2 rounded-lg border", currentTool === 'text' ? "bg-primary text-primary-foreground" : "bg-background")}>
              <Type className="h-6 w-6" />
            </div>
            <span className="text-xs">Text</span>
          </DropdownMenuItem>

          {/* Time-lapse */}
          <DropdownMenuItem
            className="flex flex-col items-center justify-center h-20 gap-1 cursor-pointer rounded-lg hover:bg-accent"
            onClick={() => setOpen(false)}
          >
            <div className="p-2 rounded-lg bg-background border">
              <Video className="h-6 w-6" />
            </div>
            <span className="text-xs">Time-lapse</span>
          </DropdownMenuItem>

          {/* Auto Hide */}
          <DropdownMenuItem
            className={cn(
              "flex flex-col items-center justify-center h-20 gap-1 cursor-pointer rounded-lg hover:bg-accent",
              autoHideToolbar && "bg-primary/10"
            )}
            onClick={() => {
              onAutoHideToggle();
              setOpen(false);
            }}
          >
            <div className={cn("p-2 rounded-lg border", autoHideToolbar ? "bg-primary text-primary-foreground" : "bg-background")}>
              <EyeOff className="h-6 w-6" />
            </div>
            <span className="text-xs">Auto Hide</span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
