import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Pipette, Grid3X3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ColorWheelPickerProps {
  color: string;
  onChange: (color: string) => void;
}

// Convert HSL to HEX
const hslToHex = (h: number, s: number, l: number): string => {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  
  if (0 <= h && h < 60) { r = c; g = x; b = 0; }
  else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
  else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
  else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
  else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
  else if (300 <= h && h < 360) { r = c; g = 0; b = x; }
  
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

// Convert HEX to HSL
const hexToHsl = (hex: string): { h: number; s: number; l: number } => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { h: 0, s: 0, l: 0 };
  
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
};

// Convert HEX to RGB
const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  };
};

// Convert RGB to HEX
const rgbToHex = (r: number, g: number, b: number): string => {
  const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

// Preset color palettes
const COLOR_PALETTES = [
  { name: 'Basic', colors: ['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'] },
  { name: 'Warm', colors: ['#FF6B6B', '#FFA07A', '#FFD700', '#FF8C00', '#FF4500', '#DC143C', '#B22222', '#8B0000'] },
  { name: 'Cool', colors: ['#87CEEB', '#6495ED', '#4169E1', '#0000CD', '#00CED1', '#20B2AA', '#2E8B57', '#3CB371'] },
  { name: 'Pastel', colors: ['#FFB6C1', '#FFDAB9', '#FFFACD', '#E0FFFF', '#D8BFD8', '#DDA0DD', '#F0E68C', '#98FB98'] },
];

export const ColorWheelPicker = ({ color, onChange }: ColorWheelPickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'wheel' | 'palette'>('wheel');
  const [hsl, setHsl] = useState(() => hexToHsl(color));
  const [rgb, setRgb] = useState(() => hexToRgb(color));
  const [hexInput, setHexInput] = useState(color.replace('#', '').toUpperCase());
  const [colorHistory, setColorHistory] = useState<string[]>([]);
  const [sliderMode, setSliderMode] = useState<'hsl' | 'rgb'>('hsl');
  
  const wheelRef = useRef<HTMLCanvasElement>(null);
  const squareRef = useRef<HTMLCanvasElement>(null);
  const [isDraggingWheel, setIsDraggingWheel] = useState(false);
  const [isDraggingSquare, setIsDraggingSquare] = useState(false);

  // Sync internal state when color prop changes
  useEffect(() => {
    const newHsl = hexToHsl(color);
    const newRgb = hexToRgb(color);
    setHsl(newHsl);
    setRgb(newRgb);
    setHexInput(color.replace('#', '').toUpperCase());
  }, [color]);

  // Draw hue wheel
  const drawWheel = useCallback(() => {
    const canvas = wheelRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const size = canvas.width;
    const centerX = size / 2;
    const centerY = size / 2;
    const outerRadius = size / 2 - 5;
    const innerRadius = outerRadius - 30;
    
    ctx.clearRect(0, 0, size, size);
    
    // Draw hue ring
    for (let angle = 0; angle < 360; angle++) {
      const startAngle = (angle - 1) * Math.PI / 180;
      const endAngle = (angle + 1) * Math.PI / 180;
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, outerRadius, startAngle, endAngle);
      ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = `hsl(${angle}, 100%, 50%)`;
      ctx.fill();
    }
    
    // Draw hue indicator
    const indicatorAngle = (hsl.h - 90) * Math.PI / 180;
    const indicatorRadius = (outerRadius + innerRadius) / 2;
    const indicatorX = centerX + Math.cos(indicatorAngle) * indicatorRadius;
    const indicatorY = centerY + Math.sin(indicatorAngle) * indicatorRadius;
    
    ctx.beginPath();
    ctx.arc(indicatorX, indicatorY, 10, 0, Math.PI * 2);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(indicatorX, indicatorY, 10, 0, Math.PI * 2);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.stroke();
  }, [hsl.h]);

  // Draw saturation/lightness square
  const drawSquare = useCallback(() => {
    const canvas = squareRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const size = canvas.width;
    
    // Create gradient for the square (diamond shape)
    ctx.clearRect(0, 0, size, size);
    
    // Draw as rotated square (diamond)
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(Math.PI / 4);
    
    const squareSize = size * 0.6;
    const halfSize = squareSize / 2;
    
    // Draw saturation/lightness gradient
    for (let x = 0; x < squareSize; x++) {
      for (let y = 0; y < squareSize; y++) {
        const saturation = (x / squareSize) * 100;
        const lightness = 100 - (y / squareSize) * 100;
        ctx.fillStyle = `hsl(${hsl.h}, ${saturation}%, ${lightness}%)`;
        ctx.fillRect(x - halfSize, y - halfSize, 1.5, 1.5);
      }
    }
    
    // Draw indicator
    const indicatorX = (hsl.s / 100) * squareSize - halfSize;
    const indicatorY = ((100 - hsl.l) / 100) * squareSize - halfSize;
    
    ctx.beginPath();
    ctx.arc(indicatorX, indicatorY, 8, 0, Math.PI * 2);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(indicatorX, indicatorY, 8, 0, Math.PI * 2);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    ctx.restore();
  }, [hsl]);

  useEffect(() => {
    drawWheel();
    drawSquare();
  }, [drawWheel, drawSquare]);

  const handleWheelInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = wheelRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const x = clientX - rect.left - canvas.width / 2;
    const y = clientY - rect.top - canvas.height / 2;
    
    let angle = Math.atan2(y, x) * 180 / Math.PI + 90;
    if (angle < 0) angle += 360;
    
    const newHsl = { ...hsl, h: Math.round(angle) };
    setHsl(newHsl);
    const newColor = hslToHex(newHsl.h, newHsl.s, newHsl.l);
    onChange(newColor);
    setRgb(hexToRgb(newColor));
    setHexInput(newColor.replace('#', '').toUpperCase());
  };

  const handleSquareInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = squareRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    // Transform to rotated coordinate system
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const x = clientX - rect.left - centerX;
    const y = clientY - rect.top - centerY;
    
    // Rotate point back
    const angle = -Math.PI / 4;
    const rotX = x * Math.cos(angle) - y * Math.sin(angle);
    const rotY = x * Math.sin(angle) + y * Math.cos(angle);
    
    const squareSize = canvas.width * 0.6;
    const halfSize = squareSize / 2;
    
    const s = Math.max(0, Math.min(100, ((rotX + halfSize) / squareSize) * 100));
    const l = Math.max(0, Math.min(100, 100 - ((rotY + halfSize) / squareSize) * 100));
    
    const newHsl = { ...hsl, s: Math.round(s), l: Math.round(l) };
    setHsl(newHsl);
    const newColor = hslToHex(newHsl.h, newHsl.s, newHsl.l);
    onChange(newColor);
    setRgb(hexToRgb(newColor));
    setHexInput(newColor.replace('#', '').toUpperCase());
  };

  const handleSliderChange = (type: 'h' | 's' | 'l' | 'r' | 'g' | 'b', value: number) => {
    if (type === 'h' || type === 's' || type === 'l') {
      const newHsl = { ...hsl, [type]: value };
      setHsl(newHsl);
      const newColor = hslToHex(newHsl.h, newHsl.s, newHsl.l);
      onChange(newColor);
      setRgb(hexToRgb(newColor));
      setHexInput(newColor.replace('#', '').toUpperCase());
    } else {
      const newRgb = { ...rgb, [type]: value };
      setRgb(newRgb);
      const newColor = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
      onChange(newColor);
      setHsl(hexToHsl(newColor));
      setHexInput(newColor.replace('#', '').toUpperCase());
    }
  };

  const handleHexChange = (value: string) => {
    setHexInput(value.toUpperCase());
    if (/^[A-Fa-f0-9]{6}$/.test(value)) {
      const newColor = `#${value}`;
      onChange(newColor);
      setHsl(hexToHsl(newColor));
      setRgb(hexToRgb(newColor));
    }
  };

  const addToHistory = () => {
    setColorHistory(prev => {
      const newHistory = [color, ...prev.filter(c => c !== color)].slice(0, 10);
      return newHistory;
    });
  };

  const getComplementaryColor = (): string => {
    const compHue = (hsl.h + 180) % 360;
    return hslToHex(compHue, hsl.s, hsl.l);
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open && color) addToHistory();
    }}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0 p-0 overflow-hidden"
          title="Color Wheel"
        >
          <div 
            className="w-full h-full rounded-md"
            style={{ 
              background: `conic-gradient(from 0deg, 
                hsl(0, 100%, 50%), 
                hsl(60, 100%, 50%), 
                hsl(120, 100%, 50%), 
                hsl(180, 100%, 50%), 
                hsl(240, 100%, 50%), 
                hsl(300, 100%, 50%), 
                hsl(360, 100%, 50%)
              )`
            }}
          />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[85vh] p-0 bg-[#3a3a3e]">
        <div className="flex flex-col h-full">
          {/* Tab Header */}
          <div className="flex border-b border-border/30">
            <button
              onClick={() => setActiveTab('wheel')}
              className={cn(
                "flex-1 py-3 flex items-center justify-center transition-colors",
                activeTab === 'wheel' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/20"
              )}
            >
              <div 
                className="w-6 h-6 rounded-full"
                style={{ 
                  background: `conic-gradient(from 0deg, 
                    hsl(0, 100%, 50%), 
                    hsl(60, 100%, 50%), 
                    hsl(120, 100%, 50%), 
                    hsl(180, 100%, 50%), 
                    hsl(240, 100%, 50%), 
                    hsl(300, 100%, 50%), 
                    hsl(360, 100%, 50%)
                  )`
                }}
              />
            </button>
            <button
              onClick={() => setActiveTab('palette')}
              className={cn(
                "flex-1 py-3 flex items-center justify-center transition-colors",
                activeTab === 'palette' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/20"
              )}
            >
              <Grid3X3 className="h-6 w-6" />
            </button>
          </div>

          {/* Color Preview Bar */}
          <div className="p-4 flex gap-4">
            <div 
              className="w-20 h-16 rounded-lg border border-border/30"
              style={{ backgroundColor: color }}
            />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Complementary</span>
                <button
                  onClick={() => onChange(getComplementaryColor())}
                  className="w-full h-4 rounded border border-border/30"
                  style={{ backgroundColor: getComplementaryColor() }}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Color History</span>
                <div className="flex gap-1 flex-1">
                  {colorHistory.slice(0, 8).map((c, i) => (
                    <button
                      key={i}
                      onClick={() => onChange(c)}
                      className="w-4 h-4 rounded-sm border border-border/30"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto">
            {activeTab === 'wheel' && (
              <div className="p-4 space-y-6">
                {/* Color Wheel */}
                <div className="relative flex items-center justify-center">
                  <canvas
                    ref={wheelRef}
                    width={260}
                    height={260}
                    className="cursor-crosshair"
                    onMouseDown={(e) => {
                      setIsDraggingWheel(true);
                      handleWheelInteraction(e);
                    }}
                    onMouseMove={(e) => isDraggingWheel && handleWheelInteraction(e)}
                    onMouseUp={() => setIsDraggingWheel(false)}
                    onMouseLeave={() => setIsDraggingWheel(false)}
                    onTouchStart={(e) => {
                      setIsDraggingWheel(true);
                      handleWheelInteraction(e);
                    }}
                    onTouchMove={(e) => isDraggingWheel && handleWheelInteraction(e)}
                    onTouchEnd={() => setIsDraggingWheel(false)}
                  />
                  <canvas
                    ref={squareRef}
                    width={160}
                    height={160}
                    className="absolute cursor-crosshair"
                    onMouseDown={(e) => {
                      setIsDraggingSquare(true);
                      handleSquareInteraction(e);
                    }}
                    onMouseMove={(e) => isDraggingSquare && handleSquareInteraction(e)}
                    onMouseUp={() => setIsDraggingSquare(false)}
                    onMouseLeave={() => setIsDraggingSquare(false)}
                    onTouchStart={(e) => {
                      setIsDraggingSquare(true);
                      handleSquareInteraction(e);
                    }}
                    onTouchMove={(e) => isDraggingSquare && handleSquareInteraction(e)}
                    onTouchEnd={() => setIsDraggingSquare(false)}
                  />
                  <button className="absolute top-2 left-2 p-2 text-muted-foreground hover:text-foreground">
                    <div className="w-5 h-5 rounded bg-gradient-to-br from-gray-300 via-gray-400 to-gray-500 opacity-50" />
                  </button>
                  <button className="absolute top-2 right-2 p-2 text-muted-foreground hover:text-foreground">
                    <Pipette className="h-5 w-5" />
                  </button>
                </div>

                {/* HEX Value */}
                <div className="flex justify-end items-center gap-2">
                  <span className="text-xs text-muted-foreground">HEX #</span>
                  <Input
                    value={hexInput}
                    onChange={(e) => handleHexChange(e.target.value)}
                    className="w-24 h-8 text-center font-mono bg-transparent border-border/30"
                    maxLength={6}
                  />
                </div>

                {/* Mode Tabs */}
                <div className="flex items-center gap-4 border-b border-border/30 pb-2">
                  <button
                    onClick={() => setSliderMode('hsl')}
                    className={cn(
                      "text-sm font-medium",
                      sliderMode === 'hsl' ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    HSL
                  </button>
                  <button
                    onClick={() => setSliderMode('rgb')}
                    className={cn(
                      "text-sm font-medium",
                      sliderMode === 'rgb' ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    RGB
                  </button>
                </div>

                {/* Sliders */}
                {sliderMode === 'hsl' ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground w-4">H</span>
                      <div className="flex-1">
                        <Slider
                          value={[hsl.h]}
                          onValueChange={([v]) => handleSliderChange('h', v)}
                          max={360}
                          step={1}
                          className="w-full"
                        />
                      </div>
                      <span className="text-sm text-muted-foreground w-8 text-right">{hsl.h}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground w-4">S</span>
                      <div className="flex-1">
                        <Slider
                          value={[hsl.s]}
                          onValueChange={([v]) => handleSliderChange('s', v)}
                          max={100}
                          step={1}
                          className="w-full"
                        />
                      </div>
                      <span className="text-sm text-muted-foreground w-8 text-right">{hsl.s}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground w-4">L</span>
                      <div className="flex-1">
                        <Slider
                          value={[hsl.l]}
                          onValueChange={([v]) => handleSliderChange('l', v)}
                          max={100}
                          step={1}
                          className="w-full"
                        />
                      </div>
                      <span className="text-sm text-muted-foreground w-8 text-right">{hsl.l}</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground w-4">R</span>
                      <div className="flex-1">
                        <Slider
                          value={[rgb.r]}
                          onValueChange={([v]) => handleSliderChange('r', v)}
                          max={255}
                          step={1}
                          className="w-full"
                        />
                      </div>
                      <span className="text-sm text-muted-foreground w-8 text-right">{rgb.r}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground w-4">G</span>
                      <div className="flex-1">
                        <Slider
                          value={[rgb.g]}
                          onValueChange={([v]) => handleSliderChange('g', v)}
                          max={255}
                          step={1}
                          className="w-full"
                        />
                      </div>
                      <span className="text-sm text-muted-foreground w-8 text-right">{rgb.g}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground w-4">B</span>
                      <div className="flex-1">
                        <Slider
                          value={[rgb.b]}
                          onValueChange={([v]) => handleSliderChange('b', v)}
                          max={255}
                          step={1}
                          className="w-full"
                        />
                      </div>
                      <span className="text-sm text-muted-foreground w-8 text-right">{rgb.b}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'palette' && (
              <div className="p-4 space-y-6">
                <h3 className="text-sm font-medium text-foreground">Palette Title</h3>
                {COLOR_PALETTES.map((palette) => (
                  <div key={palette.name} className="space-y-2">
                    <span className="text-xs text-muted-foreground">{palette.name}</span>
                    <div className="grid grid-cols-8 gap-2">
                      {palette.colors.map((c, i) => (
                        <button
                          key={i}
                          onClick={() => onChange(c)}
                          className={cn(
                            "w-8 h-8 rounded border-2 transition-all",
                            color === c ? "border-primary ring-2 ring-primary/50" : "border-border/30 hover:border-primary/50"
                          )}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
