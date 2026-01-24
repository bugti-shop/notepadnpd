import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Pencil, X, Star, ChevronRight, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BrushType {
  id: string;
  name: string;
  category: string;
  size: number;
  opacity: number;
  hardness: number;
  texture: 'smooth' | 'rough' | 'dotted' | 'hatched' | 'spray';
  pressure: boolean;
  icon: string;
}

export interface BrushSettings {
  size: number;
  opacity: number;
  pressureEnabled: boolean;
  pressureSensitivity: number; // 0.1 to 2.0
  forceSmooth: boolean; // Override texture to always use smooth strokes
}

const BRUSH_CATEGORIES = [
  {
    name: 'Basic',
    brushes: [
      { id: 'pencil-fine', name: 'Fine Pencil', size: 1, opacity: 1, hardness: 1, texture: 'smooth' as const, pressure: true, icon: '✏️' },
      { id: 'pencil-medium', name: 'Medium Pencil', size: 2, opacity: 1, hardness: 0.9, texture: 'smooth' as const, pressure: true, icon: '✏️' },
      { id: 'pencil-thick', name: 'Thick Pencil', size: 4, opacity: 1, hardness: 0.8, texture: 'smooth' as const, pressure: true, icon: '✏️' },
      { id: 'pen-fine', name: 'Fine Pen', size: 1, opacity: 1, hardness: 1, texture: 'smooth' as const, pressure: false, icon: '🖊️' },
      { id: 'pen-medium', name: 'Medium Pen', size: 2, opacity: 1, hardness: 1, texture: 'smooth' as const, pressure: false, icon: '🖊️' },
      { id: 'fountain-pen', name: 'Fountain Pen', size: 3, opacity: 1, hardness: 0.9, texture: 'smooth' as const, pressure: true, icon: '🖋️' },
      { id: 'ballpoint', name: 'Ballpoint', size: 2, opacity: 0.95, hardness: 1, texture: 'smooth' as const, pressure: false, icon: '🖊️' },
      { id: 'gel-pen', name: 'Gel Pen', size: 2, opacity: 1, hardness: 1, texture: 'smooth' as const, pressure: false, icon: '🖊️' },
      { id: 'felt-tip', name: 'Felt Tip', size: 3, opacity: 0.9, hardness: 0.7, texture: 'smooth' as const, pressure: true, icon: '🖍️' },
      { id: 'technical-pen', name: 'Technical Pen', size: 1, opacity: 1, hardness: 1, texture: 'smooth' as const, pressure: false, icon: '📐' },
    ]
  },
  {
    name: 'Markers',
    brushes: [
      { id: 'marker-thin', name: 'Thin Marker', size: 3, opacity: 0.85, hardness: 0.8, texture: 'smooth' as const, pressure: true, icon: '🖌️' },
      { id: 'marker-medium', name: 'Medium Marker', size: 6, opacity: 0.8, hardness: 0.7, texture: 'smooth' as const, pressure: true, icon: '🖌️' },
      { id: 'marker-thick', name: 'Thick Marker', size: 10, opacity: 0.75, hardness: 0.6, texture: 'smooth' as const, pressure: true, icon: '🖌️' },
      { id: 'highlighter-thin', name: 'Thin Highlighter', size: 8, opacity: 0.4, hardness: 0.5, texture: 'smooth' as const, pressure: false, icon: '🌟' },
      { id: 'highlighter-wide', name: 'Wide Highlighter', size: 15, opacity: 0.35, hardness: 0.4, texture: 'smooth' as const, pressure: false, icon: '🌟' },
      { id: 'chisel-marker', name: 'Chisel Marker', size: 8, opacity: 0.9, hardness: 0.8, texture: 'smooth' as const, pressure: true, icon: '🖊️' },
      { id: 'brush-marker', name: 'Brush Marker', size: 5, opacity: 0.85, hardness: 0.6, texture: 'smooth' as const, pressure: true, icon: '🖌️' },
      { id: 'alcohol-marker', name: 'Alcohol Marker', size: 7, opacity: 0.7, hardness: 0.5, texture: 'smooth' as const, pressure: true, icon: '🎨' },
    ]
  },
  {
    name: 'Artist Brushes',
    brushes: [
      { id: 'round-small', name: 'Small Round', size: 4, opacity: 0.9, hardness: 0.6, texture: 'smooth' as const, pressure: true, icon: '🖌️' },
      { id: 'round-medium', name: 'Medium Round', size: 8, opacity: 0.85, hardness: 0.5, texture: 'smooth' as const, pressure: true, icon: '🖌️' },
      { id: 'round-large', name: 'Large Round', size: 12, opacity: 0.8, hardness: 0.4, texture: 'smooth' as const, pressure: true, icon: '🖌️' },
      { id: 'flat-small', name: 'Small Flat', size: 6, opacity: 0.9, hardness: 0.7, texture: 'smooth' as const, pressure: true, icon: '🖌️' },
      { id: 'flat-large', name: 'Large Flat', size: 15, opacity: 0.8, hardness: 0.6, texture: 'smooth' as const, pressure: true, icon: '🖌️' },
      { id: 'fan-brush', name: 'Fan Brush', size: 20, opacity: 0.5, hardness: 0.3, texture: 'hatched' as const, pressure: true, icon: '🪭' },
      { id: 'filbert', name: 'Filbert', size: 10, opacity: 0.85, hardness: 0.5, texture: 'smooth' as const, pressure: true, icon: '🖌️' },
      { id: 'liner', name: 'Liner Brush', size: 1, opacity: 1, hardness: 0.9, texture: 'smooth' as const, pressure: true, icon: '🖌️' },
      { id: 'rigger', name: 'Rigger', size: 2, opacity: 0.95, hardness: 0.8, texture: 'smooth' as const, pressure: true, icon: '🖌️' },
      { id: 'mop-brush', name: 'Mop Brush', size: 25, opacity: 0.6, hardness: 0.3, texture: 'smooth' as const, pressure: true, icon: '🖌️' },
    ]
  },
  {
    name: 'Texture',
    brushes: [
      { id: 'charcoal-soft', name: 'Soft Charcoal', size: 8, opacity: 0.7, hardness: 0.3, texture: 'rough' as const, pressure: true, icon: '🖤' },
      { id: 'charcoal-hard', name: 'Hard Charcoal', size: 4, opacity: 0.85, hardness: 0.6, texture: 'rough' as const, pressure: true, icon: '🖤' },
      { id: 'chalk', name: 'Chalk', size: 6, opacity: 0.6, hardness: 0.4, texture: 'rough' as const, pressure: true, icon: '🤍' },
      { id: 'pastel-soft', name: 'Soft Pastel', size: 10, opacity: 0.65, hardness: 0.35, texture: 'rough' as const, pressure: true, icon: '🎨' },
      { id: 'pastel-hard', name: 'Hard Pastel', size: 5, opacity: 0.75, hardness: 0.5, texture: 'rough' as const, pressure: true, icon: '🎨' },
      { id: 'oil-pastel', name: 'Oil Pastel', size: 8, opacity: 0.8, hardness: 0.5, texture: 'rough' as const, pressure: true, icon: '🖍️' },
      { id: 'conte', name: 'Conté Crayon', size: 5, opacity: 0.7, hardness: 0.5, texture: 'rough' as const, pressure: true, icon: '🖍️' },
      { id: 'graphite-soft', name: 'Soft Graphite', size: 6, opacity: 0.5, hardness: 0.4, texture: 'rough' as const, pressure: true, icon: '✏️' },
    ]
  },
  {
    name: 'Spray & Effects',
    brushes: [
      { id: 'airbrush-fine', name: 'Fine Airbrush', size: 15, opacity: 0.2, hardness: 0.1, texture: 'spray' as const, pressure: true, icon: '💨' },
      { id: 'airbrush-medium', name: 'Medium Airbrush', size: 30, opacity: 0.15, hardness: 0.1, texture: 'spray' as const, pressure: true, icon: '💨' },
      { id: 'airbrush-large', name: 'Large Airbrush', size: 50, opacity: 0.1, hardness: 0.05, texture: 'spray' as const, pressure: true, icon: '💨' },
      { id: 'spatter', name: 'Spatter', size: 20, opacity: 0.6, hardness: 0.2, texture: 'spray' as const, pressure: true, icon: '💦' },
      { id: 'stipple', name: 'Stipple', size: 8, opacity: 0.7, hardness: 0.3, texture: 'dotted' as const, pressure: true, icon: '⚫' },
      { id: 'splatter', name: 'Splatter', size: 25, opacity: 0.5, hardness: 0.2, texture: 'spray' as const, pressure: false, icon: '💥' },
    ]
  },
  {
    name: 'Calligraphy',
    brushes: [
      { id: 'calligraphy-thin', name: 'Thin Calligraphy', size: 2, opacity: 1, hardness: 1, texture: 'smooth' as const, pressure: true, icon: '🖋️' },
      { id: 'calligraphy-medium', name: 'Medium Calligraphy', size: 4, opacity: 1, hardness: 1, texture: 'smooth' as const, pressure: true, icon: '🖋️' },
      { id: 'calligraphy-thick', name: 'Thick Calligraphy', size: 6, opacity: 1, hardness: 1, texture: 'smooth' as const, pressure: true, icon: '🖋️' },
      { id: 'brush-calligraphy', name: 'Brush Calligraphy', size: 5, opacity: 0.95, hardness: 0.8, texture: 'smooth' as const, pressure: true, icon: '🖌️' },
      { id: 'pointed-pen', name: 'Pointed Pen', size: 2, opacity: 1, hardness: 1, texture: 'smooth' as const, pressure: true, icon: '✒️' },
      { id: 'flat-nib', name: 'Flat Nib', size: 4, opacity: 1, hardness: 1, texture: 'smooth' as const, pressure: true, icon: '✒️' },
    ]
  },
  {
    name: 'Special',
    brushes: [
      { id: 'crayon', name: 'Crayon', size: 8, opacity: 0.7, hardness: 0.5, texture: 'rough' as const, pressure: true, icon: '🖍️' },
      { id: 'wax-crayon', name: 'Wax Crayon', size: 10, opacity: 0.8, hardness: 0.6, texture: 'rough' as const, pressure: true, icon: '🖍️' },
      { id: 'dry-brush', name: 'Dry Brush', size: 12, opacity: 0.5, hardness: 0.4, texture: 'hatched' as const, pressure: true, icon: '🖌️' },
      { id: 'watercolor', name: 'Watercolor', size: 15, opacity: 0.4, hardness: 0.2, texture: 'smooth' as const, pressure: true, icon: '💧' },
      { id: 'ink-wash', name: 'Ink Wash', size: 20, opacity: 0.5, hardness: 0.3, texture: 'smooth' as const, pressure: true, icon: '🖤' },
      { id: 'blender', name: 'Blender', size: 10, opacity: 0.3, hardness: 0.2, texture: 'smooth' as const, pressure: true, icon: '🔄' },
    ]
  }
];

interface BrushPickerProps {
  selectedBrush: BrushType | null;
  onBrushSelect: (brush: BrushType, settings: BrushSettings) => void;
  brushSettings: BrushSettings;
  onSettingsChange: (settings: BrushSettings) => void;
  currentColor?: string;
}

// Brush Preview Component
const BrushPreview = ({ 
  brushSettings, 
  selectedBrush,
  color = '#000000'
}: { 
  brushSettings: BrushSettings; 
  selectedBrush: BrushType | null;
  color: string;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const drawPreview = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);

    // Get computed styles for theme-aware colors
    const computedStyle = getComputedStyle(document.documentElement);
    const isDarkMode = document.documentElement.classList.contains('dark');
    
    // Use actual color values instead of CSS variables
    const bgColor = isDarkMode ? '#1a1a2e' : '#f5f5f7';
    const mutedColor = isDarkMode ? '#2a2a3e' : '#e8e8ec';

    // Clear with subtle gradient background
    const gradient = ctx.createLinearGradient(0, 0, rect.width, 0);
    gradient.addColorStop(0, mutedColor);
    gradient.addColorStop(0.5, bgColor);
    gradient.addColorStop(1, mutedColor);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Draw a sample stroke
    const padding = 20;
    const startX = padding;
    const endX = rect.width - padding;
    const centerY = rect.height / 2;
    const amplitude = rect.height * 0.25;

    ctx.beginPath();
    ctx.moveTo(startX, centerY);

    // Create a smooth wave pattern to show brush characteristics
    const points: { x: number; y: number }[] = [];
    const numPoints = 100;
    
    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      const x = startX + (endX - startX) * t;
      // Create a sine wave with varying amplitude to simulate pressure
      const pressureEffect = Math.sin(t * Math.PI); // 0 at ends, 1 in middle
      const y = centerY + Math.sin(t * Math.PI * 3) * amplitude * pressureEffect;
      points.push({ x, y });
    }

    // Draw stroke based on brush type
    const texture = selectedBrush?.texture || 'smooth';
    const hardness = selectedBrush?.hardness || 1;
    const baseSize = brushSettings.size;
    const opacity = brushSettings.opacity;

    ctx.globalAlpha = opacity;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (texture === 'spray') {
      // Spray/airbrush effect
      for (let i = 0; i < points.length - 1; i++) {
        const point = points[i];
        const pressureEffect = brushSettings.pressureEnabled 
          ? 0.5 + Math.sin((i / points.length) * Math.PI) * 0.5
          : 1;
        const size = baseSize * pressureEffect;
        
        // Create spray dots
        const density = Math.ceil(size * 2);
        for (let j = 0; j < density; j++) {
          const angle = Math.random() * Math.PI * 2;
          const radius = Math.random() * size * 1.5;
          const dotSize = Math.random() * 1.5 + 0.5;
          ctx.globalAlpha = opacity * (0.3 + Math.random() * 0.4);
          ctx.beginPath();
          ctx.arc(
            point.x + Math.cos(angle) * radius,
            point.y + Math.sin(angle) * radius,
            dotSize,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
      }
    } else if (texture === 'dotted') {
      // Stipple effect
      for (let i = 0; i < points.length; i += 2) {
        const point = points[i];
        const pressureEffect = brushSettings.pressureEnabled 
          ? 0.5 + Math.sin((i / points.length) * Math.PI) * 0.5
          : 1;
        const size = baseSize * pressureEffect * 0.8;
        
        ctx.beginPath();
        ctx.arc(point.x, point.y, size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (texture === 'rough' || texture === 'hatched') {
      // Rough/textured stroke
      ctx.lineWidth = baseSize * 0.8;
      
      for (let i = 0; i < points.length - 1; i++) {
        const point = points[i];
        const nextPoint = points[i + 1];
        const pressureEffect = brushSettings.pressureEnabled 
          ? 0.5 + Math.sin((i / points.length) * Math.PI) * 0.5
          : 1;
        
        ctx.lineWidth = baseSize * pressureEffect;
        ctx.globalAlpha = opacity * (0.6 + Math.random() * 0.4);
        
        // Add slight jitter for rough texture
        const jitter = texture === 'rough' ? (1 - hardness) * 2 : 0;
        
        ctx.beginPath();
        ctx.moveTo(point.x + (Math.random() - 0.5) * jitter, point.y + (Math.random() - 0.5) * jitter);
        ctx.lineTo(nextPoint.x + (Math.random() - 0.5) * jitter, nextPoint.y + (Math.random() - 0.5) * jitter);
        ctx.stroke();
      }
    } else {
      // Smooth stroke (default)
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      
      for (let i = 1; i < points.length - 1; i++) {
        const pressureEffect = brushSettings.pressureEnabled 
          ? 0.5 + Math.sin((i / points.length) * Math.PI) * 0.5
          : 1;
        
        // Variable width based on pressure
        if (brushSettings.pressureEnabled) {
          ctx.stroke();
          ctx.lineWidth = baseSize * pressureEffect;
          ctx.beginPath();
          ctx.moveTo(points[i - 1].x, points[i - 1].y);
        } else {
          ctx.lineWidth = baseSize;
        }
        
        // Smooth curve using quadratic bezier
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
      }
      
      ctx.stroke();
    }

    // Reset alpha
    ctx.globalAlpha = 1;

    // Add subtle border using actual color
    const borderColor = isDarkMode ? '#3a3a4e' : '#d1d1d6';
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, rect.width - 1, rect.height - 1);
  }, [brushSettings, selectedBrush, color]);

  useEffect(() => {
    drawPreview();
  }, [drawPreview]);

  useEffect(() => {
    const handleResize = () => drawPreview();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawPreview]);

  return (
    <div 
      ref={containerRef}
      className="w-full h-16 rounded-lg overflow-hidden border border-border shadow-inner"
    >
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};

export const BrushPicker = ({ selectedBrush, onBrushSelect, brushSettings, onSettingsChange, currentColor = '#000000' }: BrushPickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'advanced'>('basic');
  const [favorites, setFavorites] = useState<string[]>([]);

  // Load favorites from IndexedDB
  useEffect(() => {
    import('@/utils/settingsStorage').then(({ getSetting }) => {
      getSetting<string[]>('sketch-favorite-brushes', []).then(setFavorites);
    });
  }, []);

  const toggleFavorite = (brushId: string) => {
    const newFavorites = favorites.includes(brushId)
      ? favorites.filter(id => id !== brushId)
      : [...favorites, brushId];
    setFavorites(newFavorites);
    import('@/utils/settingsStorage').then(({ setSetting }) => {
      setSetting('sketch-favorite-brushes', newFavorites);
    });
  };

  const handleBrushSelect = (brush: typeof BRUSH_CATEGORIES[0]['brushes'][0], category: string) => {
    const brushType: BrushType = {
      ...brush,
      category
    };
    // Update settings with brush defaults
    const newSettings: BrushSettings = {
      ...brushSettings,
      size: brush.size,
      opacity: brush.opacity,
      pressureEnabled: brush.pressure
    };
    onSettingsChange(newSettings);
    onBrushSelect(brushType, newSettings);
  };

  const resetSettings = () => {
    if (selectedBrush) {
      // Find the default brush from categories
      let defaultBrush: { size: number; opacity: number; pressure: boolean } | undefined;
      for (const cat of BRUSH_CATEGORIES) {
        const found = cat.brushes.find(b => b.id === selectedBrush.id);
        if (found) {
          defaultBrush = found;
          break;
        }
      }
      
      if (defaultBrush) {
        onSettingsChange({
          size: defaultBrush.size,
          opacity: defaultBrush.opacity,
          pressureEnabled: defaultBrush.pressure,
          pressureSensitivity: 1.0,
          forceSmooth: false
        });
      }
    } else {
      onSettingsChange({
        size: 2,
        opacity: 1,
        pressureEnabled: false,
        pressureSensitivity: 1.0,
        forceSmooth: false
      });
    }
  };

  const getFavoriteBrushes = () => {
    const favBrushes: Array<{ brush: typeof BRUSH_CATEGORIES[0]['brushes'][0]; category: string }> = [];
    BRUSH_CATEGORIES.forEach(cat => {
      cat.brushes.forEach(brush => {
        if (favorites.includes(brush.id)) {
          favBrushes.push({ brush, category: cat.name });
        }
      });
    });
    return favBrushes;
  };

  const favoriteBrushes = getFavoriteBrushes();

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant={selectedBrush ? 'default' : 'outline'}
          size="icon"
          className="h-8 w-8 shrink-0"
          title={selectedBrush ? selectedBrush.name : 'Brush Picker'}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[75vh] p-0">
        <div className="flex h-full">
          {/* Left Side - Brush Selection */}
          <div className="flex-1 border-r flex flex-col">
            <SheetHeader className="p-4 pb-2 border-b">
              <SheetTitle className="flex items-center justify-between">
                <span>Brush Library</span>
              </SheetTitle>
            </SheetHeader>
            
            <ScrollArea className="flex-1">
              <div className="space-y-4 p-4">
                {/* Favorites Section */}
                {favoriteBrushes.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                      <h3 className="text-sm font-semibold text-foreground">Favorites</h3>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {favoriteBrushes.map(({ brush, category }) => (
                        <button
                          key={brush.id}
                          onClick={() => handleBrushSelect(brush, category)}
                          className={cn(
                            "flex flex-col items-center justify-center p-2 rounded-lg border transition-all",
                            selectedBrush?.id === brush.id
                              ? "border-primary bg-primary/10 ring-2 ring-primary"
                              : "border-border hover:border-primary/50 hover:bg-muted"
                          )}
                        >
                          <span className="text-xl mb-1">{brush.icon}</span>
                          <span className="text-[9px] text-center text-muted-foreground line-clamp-1">{brush.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Brush Categories */}
                {BRUSH_CATEGORIES.map((category) => (
                  <div key={category.name}>
                    <h3 className="text-sm font-semibold text-foreground mb-2">{category.name}</h3>
                    <div className="grid grid-cols-4 gap-2">
                      {category.brushes.map((brush) => (
                        <div key={brush.id} className="relative">
                          <button
                            onClick={() => handleBrushSelect(brush, category.name)}
                            className={cn(
                              "w-full flex flex-col items-center justify-center p-2 rounded-lg border transition-all",
                              selectedBrush?.id === brush.id
                                ? "border-primary bg-primary/10 ring-2 ring-primary"
                                : "border-border hover:border-primary/50 hover:bg-muted"
                            )}
                          >
                            <span className="text-xl mb-1">{brush.icon}</span>
                            <span className="text-[9px] text-center text-muted-foreground line-clamp-1">{brush.name}</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(brush.id);
                            }}
                            className={cn(
                              "absolute -top-1 -right-1 h-4 w-4 rounded-full flex items-center justify-center transition-all",
                              favorites.includes(brush.id)
                                ? "bg-amber-500 text-white"
                                : "bg-muted text-muted-foreground hover:bg-amber-100"
                            )}
                          >
                            <Star className={cn(
                              "h-2.5 w-2.5",
                              favorites.includes(brush.id) && "fill-white"
                            )} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Right Side - Settings Panel */}
          <div className="w-[45%] flex flex-col bg-muted/30">
            {/* Brush Info Header */}
            <div className="p-4 border-b bg-card">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{selectedBrush?.icon || '✏️'}</span>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm">{selectedBrush?.name || 'Default Pen'}</h3>
                  <p className="text-xs text-muted-foreground">{selectedBrush?.category || 'Basic'}</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (selectedBrush) toggleFavorite(selectedBrush.id);
                  }}
                  className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center transition-all",
                    selectedBrush && favorites.includes(selectedBrush.id)
                      ? "text-amber-500"
                      : "text-muted-foreground hover:text-amber-500"
                  )}
                >
                  <Star className={cn(
                    "h-5 w-5",
                    selectedBrush && favorites.includes(selectedBrush.id) && "fill-amber-500"
                  )} />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'basic' | 'advanced')} className="flex-1 flex flex-col">
              <TabsList className="grid w-full grid-cols-2 rounded-none border-b">
                <TabsTrigger value="basic" className="rounded-none data-[state=active]:bg-background">BASIC</TabsTrigger>
                <TabsTrigger value="advanced" className="rounded-none data-[state=active]:bg-background">ADVANCED</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="flex-1 p-4 space-y-5 mt-0">
                {/* Brush Preview */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Preview</Label>
                  <BrushPreview 
                    brushSettings={brushSettings} 
                    selectedBrush={selectedBrush}
                    color={currentColor}
                  />
                </div>

                {/* Size Slider */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Size</Label>
                    <span className="text-sm text-muted-foreground">{brushSettings.size.toFixed(1)}</span>
                  </div>
                  <Slider
                    value={[brushSettings.size]}
                    onValueChange={([value]) => onSettingsChange({ ...brushSettings, size: value })}
                    min={0.5}
                    max={100}
                    step={0.5}
                    className="w-full"
                  />
                </div>

                {/* Opacity Slider */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Opacity</Label>
                    <span className="text-sm text-muted-foreground">{Math.round(brushSettings.opacity * 100)}%</span>
                  </div>
                  <Slider
                    value={[brushSettings.opacity * 100]}
                    onValueChange={([value]) => onSettingsChange({ ...brushSettings, opacity: value / 100 })}
                    min={5}
                    max={100}
                    step={1}
                    className="w-full"
                  />
                </div>
              </TabsContent>

              <TabsContent value="advanced" className="flex-1 p-4 space-y-4 mt-0">
                {/* Pressure Toggle */}
                <div className="flex items-center justify-between py-3 border-b">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium">Pressure</Label>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <Switch
                    checked={brushSettings.pressureEnabled}
                    onCheckedChange={(checked) => onSettingsChange({ ...brushSettings, pressureEnabled: checked })}
                  />
                </div>

                {/* Pressure Sensitivity */}
                {brushSettings.pressureEnabled && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Sensitivity</Label>
                      <span className="text-sm text-muted-foreground">{brushSettings.pressureSensitivity.toFixed(1)}x</span>
                    </div>
                    <Slider
                      value={[brushSettings.pressureSensitivity * 50]}
                      onValueChange={([value]) => onSettingsChange({ ...brushSettings, pressureSensitivity: value / 50 })}
                      min={5}
                      max={100}
                      step={5}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      Simulates pen pressure using drawing speed. Faster = thinner strokes.
                    </p>
                  </div>
                )}

                {/* Force Smooth Toggle */}
                <div className="flex items-center justify-between py-3 border-b">
                  <div className="flex flex-col gap-0.5">
                    <Label className="text-sm font-medium">Force Smooth</Label>
                    <span className="text-xs text-muted-foreground">Override brush texture</span>
                  </div>
                  <Switch
                    checked={brushSettings.forceSmooth}
                    onCheckedChange={(checked) => onSettingsChange({ ...brushSettings, forceSmooth: checked })}
                  />
                </div>

                {/* Brush Info */}
                <div className="pt-4 border-t space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase">Brush Properties</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Texture:</span>
                      <span className="capitalize">{selectedBrush?.texture || 'smooth'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Hardness:</span>
                      <span>{Math.round((selectedBrush?.hardness || 1) * 100)}%</span>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Reset Button */}
            <div className="p-4 border-t">
              <Button
                variant="outline"
                className="w-full"
                onClick={resetSettings}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export { BRUSH_CATEGORIES };
