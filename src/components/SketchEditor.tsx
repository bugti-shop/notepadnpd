import { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Eraser, Pen, Trash2, Circle, Square, Minus, Triangle, MoveRight, Star, Hexagon, Pentagon, Octagon, Diamond, Heart, Plus, Move, PaintBucket, X, Undo2, Redo2, Type, RotateCw, Menu, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BrushPicker, BrushType, BrushSettings } from './BrushPicker';
import { SketchLayerPanel, SketchLayer } from './SketchLayerPanel';
import { ColorWheelPicker } from './ColorWheelPicker';
import { SketchToolbar, SketchTool } from './SketchToolbar';
import { DrawTool } from './SketchToolsMenu';

interface SketchEditorProps {
  content: string;
  onChange: (content: string) => void;
}

interface Shape {
  id: string;
  type: 'rectangle' | 'circle' | 'line' | 'triangle' | 'arrow' | 'star' | 'hexagon' | 'pentagon' | 'octagon' | 'diamond' | 'heart' | 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  brushSize: number;
  fill: boolean;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  rotation?: number;
  layerId: string; // Associate shape with a layer
}

interface LayerData {
  penStrokesData: string | null;
}

interface HistoryState {
  shapes: Shape[];
  penStrokesData: string | null;
  layers: SketchLayer[];
  layerStrokes: { [layerId: string]: string | null };
  activeLayerId: string;
}

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | 'rotate' | null;

const DEFAULT_COLORS = [
  '#000000', '#FF0000', '#0000FF', '#00FF00', '#FFFF00',
  '#FF00FF', '#00FFFF', '#FFA500', '#800080', '#FFC0CB',
];

const BRUSH_SIZES = [2, 5, 10, 15];
const HANDLE_SIZE = 10;
const ROTATION_HANDLE_DISTANCE = 25;

const FONT_SIZES = [12, 16, 20, 24, 32, 48, 64];
const FONT_FAMILIES = [
  { value: 'sans-serif', label: 'Sans Serif' },
  { value: 'serif', label: 'Serif' },
  { value: 'monospace', label: 'Monospace' },
  { value: 'cursive', label: 'Cursive' },
  { value: 'fantasy', label: 'Fantasy' },
];

const loadCustomColors = async (): Promise<string[]> => {
  try {
    const { getSetting } = await import('@/utils/settingsStorage');
    return getSetting<string[]>('sketch-custom-colors', []);
  } catch {
    return [];
  }
};

const saveCustomColors = async (colors: string[]) => {
  try {
    const { setSetting } = await import('@/utils/settingsStorage');
    await setSetting('sketch-custom-colors', colors);
  } catch (error) {
    console.error('Failed to save custom colors:', error);
  }
};

const createDefaultLayer = (): SketchLayer => ({
  id: 'layer-' + Date.now(),
  name: 'Layer 1',
  visible: true,
  locked: false,
  opacity: 1,
  order: 0,
  blendMode: 'normal'
});

export const SketchEditor = ({ content, onChange }: SketchEditorProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<DrawTool>('pen');
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(2);
  const [fillEnabled, setFillEnabled] = useState(false);
  const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [tempCanvas, setTempCanvas] = useState<ImageData | null>(null);
  const [customColors, setCustomColors] = useState<string[]>([]);
  const [newColor, setNewColor] = useState('#000000');
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [selectedShape, setSelectedShape] = useState<Shape | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [penStrokes, setPenStrokes] = useState<ImageData | null>(null);
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle>(null);
  const [initialShapeState, setInitialShapeState] = useState<Shape | null>(null);
  
  // Layer state
  const [layers, setLayers] = useState<SketchLayer[]>(() => [createDefaultLayer()]);
  const [activeLayerId, setActiveLayerId] = useState<string>(() => 'layer-' + Date.now());
  const [layerStrokes, setLayerStrokes] = useState<{ [layerId: string]: ImageData | null }>({});
  const [layerThumbnails, setLayerThumbnails] = useState<{ [layerId: string]: string | null }>({});
  
  // Brush state
  const [selectedBrush, setSelectedBrush] = useState<BrushType | null>(null);
  const [brushSettings, setBrushSettings] = useState<BrushSettings>({
    size: 2,
    opacity: 1,
    pressureEnabled: false,
    pressureSensitivity: 1.0,
    forceSmooth: false
  });
  
  // Velocity tracking for pressure simulation
  const lastDrawTime = useRef<number>(0);
  const lastDrawPos = useRef<{ x: number; y: number } | null>(null);
  const currentVelocity = useRef<number>(0);
  
  // Text input state
  const [textInputPos, setTextInputPos] = useState<{ x: number; y: number } | null>(null);
  const [textInputValue, setTextInputValue] = useState('');
  const textInputRef = useRef<HTMLInputElement>(null);
  const [fontSize, setFontSize] = useState(24);
  const [fontFamily, setFontFamily] = useState('sans-serif');
  const [editingTextShape, setEditingTextShape] = useState<Shape | null>(null);
  
  // Shape action icons state
  const [isMoveMode, setIsMoveMode] = useState(false);
  
  // Tools menu feature toggles
  const [symmetryEnabled, setSymmetryEnabled] = useState(false);
  const [symmetryMode, setSymmetryMode] = useState<'vertical' | 'horizontal' | 'radial'>('vertical');
  const [symmetrySegments, setSymmetrySegments] = useState(8); // For radial symmetry
  const [steadyStrokeEnabled, setSteadyStrokeEnabled] = useState(false);
  const [predictiveStrokeEnabled, setPredictiveStrokeEnabled] = useState(false);
  const [guidesEnabled, setGuidesEnabled] = useState(false);
  const [autoHideToolbar, setAutoHideToolbar] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  
  // Canvas container ref
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  
  // Double click tracking
  const lastClickTime = useRef<number>(0);
  const lastClickShape = useRef<string | null>(null);

  // Hold/Long-press to move shapes (prevents drawing while holding)
  const SHAPE_HOLD_DELAY_MS = 300;
  const shapeHoldTimerRef = useRef<number | null>(null);
  const shapeHoldPendingRef = useRef(false);
  const shapeHoldActivatedRef = useRef(false);
  const shapeHoldShapeIdRef = useRef<string | null>(null);
  const shapeHoldStartClientRef = useRef<{ x: number; y: number } | null>(null);
  const shapeHoldStartCanvasRef = useRef<{ x: number; y: number } | null>(null);

  const clearShapeHoldTimer = useCallback(() => {
    if (shapeHoldTimerRef.current) {
      window.clearTimeout(shapeHoldTimerRef.current);
      shapeHoldTimerRef.current = null;
    }
    shapeHoldPendingRef.current = false;
  }, []);

  // Undo/Redo history - using simplified approach for now
  const defaultLayer = layers[0] || createDefaultLayer();
  const [history, setHistory] = useState<HistoryState[]>([{ 
    shapes: [], 
    penStrokesData: null, 
    layers: [defaultLayer],
    layerStrokes: {},
    activeLayerId: defaultLayer.id
  }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const isUndoRedoAction = useRef(false);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  // Get effective brush settings with pressure simulation
  const getEffectiveBrushSettings = useCallback((velocityMultiplier: number = 1) => {
    const baseSettings = selectedBrush && tool === 'pen' 
      ? {
          size: brushSettings.size,
          opacity: brushSettings.opacity,
          hardness: selectedBrush.hardness,
          // If forceSmooth is enabled, override texture to smooth
          texture: brushSettings.forceSmooth ? 'smooth' as const : selectedBrush.texture
        }
      : {
          size: brushSize,
          opacity: 1,
          hardness: 1,
          texture: 'smooth' as const
        };

    // Apply pressure simulation based on velocity
    if (brushSettings.pressureEnabled && tool === 'pen') {
      // velocityMultiplier: 0 = slowest (thick), 1+ = fast (thin)
      const pressureEffect = 1 - (velocityMultiplier * 0.5 * brushSettings.pressureSensitivity);
      const clampedEffect = Math.max(0.3, Math.min(1.5, pressureEffect));
      
      return {
        ...baseSettings,
        size: baseSettings.size * clampedEffect,
        opacity: baseSettings.opacity * Math.max(0.4, clampedEffect)
      };
    }
    
    return baseSettings;
  }, [selectedBrush, tool, brushSize, brushSettings]);

  // Get symmetry points for a given position
  const getSymmetryPoints = useCallback((x: number, y: number, canvasWidth: number, canvasHeight: number): { x: number; y: number }[] => {
    if (!symmetryEnabled) return [{ x, y }];

    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    const points: { x: number; y: number }[] = [{ x, y }];

    if (symmetryMode === 'vertical') {
      // Mirror across vertical center line
      points.push({ x: centerX * 2 - x, y });
    } else if (symmetryMode === 'horizontal') {
      // Mirror across horizontal center line
      points.push({ x, y: centerY * 2 - y });
    } else if (symmetryMode === 'radial') {
      // Radial symmetry around center
      const dx = x - centerX;
      const dy = y - centerY;
      const radius = Math.sqrt(dx * dx + dy * dy);
      const startAngle = Math.atan2(dy, dx);

      for (let i = 1; i < symmetrySegments; i++) {
        const angle = startAngle + (i * 2 * Math.PI) / symmetrySegments;
        points.push({
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle)
        });
      }
    }

    return points;
  }, [symmetryEnabled, symmetryMode, symmetrySegments]);

  // Calculate velocity from mouse movement
  const calculateVelocity = useCallback((x: number, y: number): number => {
    const now = Date.now();
    const timeDelta = now - lastDrawTime.current;
    
    if (timeDelta === 0 || !lastDrawPos.current) {
      lastDrawTime.current = now;
      lastDrawPos.current = { x, y };
      return 0;
    }
    
    const dx = x - lastDrawPos.current.x;
    const dy = y - lastDrawPos.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const velocity = distance / timeDelta; // pixels per ms
    
    // Smooth the velocity
    const smoothedVelocity = currentVelocity.current * 0.7 + velocity * 0.3;
    currentVelocity.current = smoothedVelocity;
    
    lastDrawTime.current = now;
    lastDrawPos.current = { x, y };
    
    // Normalize velocity (typical range 0-2, where 0.5 is normal speed)
    return Math.min(2, smoothedVelocity * 10);
  }, []);

  // Convert ImageData to base64 string for storage
  const imageDataToBase64 = (imageData: ImageData | null): string | null => {
    if (!imageData) return null;
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL();
  };

  // Generate layer thumbnail from ImageData
  const generateLayerThumbnail = useCallback((imageData: ImageData | null, layerId: string) => {
    if (!imageData) {
      setLayerThumbnails(prev => ({ ...prev, [layerId]: null }));
      return;
    }
    const canvas = document.createElement('canvas');
    const thumbWidth = 100;
    const thumbHeight = 75;
    canvas.width = thumbWidth;
    canvas.height = thumbHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Draw scaled version
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = imageData.width;
    tempCanvas.height = imageData.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;
    tempCtx.putImageData(imageData, 0, 0);
    
    ctx.drawImage(tempCanvas, 0, 0, thumbWidth, thumbHeight);
    setLayerThumbnails(prev => ({ ...prev, [layerId]: canvas.toDataURL() }));
  }, []);

  // Convert base64 string back to ImageData
  const base64ToImageData = useCallback((base64: string | null, callback: (data: ImageData | null) => void) => {
    if (!base64) {
      callback(null);
      return;
    }
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        callback(null);
        return;
      }
      ctx.drawImage(img, 0, 0);
      callback(ctx.getImageData(0, 0, canvas.width, canvas.height));
    };
    img.src = base64;
  }, []);

  // Save current state to history
  const saveToHistory = useCallback((newShapes: Shape[], newPenStrokes: ImageData | null) => {
    if (isUndoRedoAction.current) {
      isUndoRedoAction.current = false;
      return;
    }

    // Convert layer strokes to base64
    const layerStrokesBase64: { [key: string]: string | null } = {};
    Object.entries(layerStrokes).forEach(([id, data]) => {
      layerStrokesBase64[id] = imageDataToBase64(data);
    });

    const newState: HistoryState = {
      shapes: JSON.parse(JSON.stringify(newShapes)),
      penStrokesData: imageDataToBase64(newPenStrokes),
      layers: JSON.parse(JSON.stringify(layers)),
      layerStrokes: layerStrokesBase64,
      activeLayerId
    };

    setHistory(prev => {
      // Remove any future states if we're not at the end
      const newHistory = prev.slice(0, historyIndex + 1);
      // Add new state and limit history size to 50 entries
      const updatedHistory = [...newHistory, newState].slice(-50);
      return updatedHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [historyIndex, layers, layerStrokes, activeLayerId]);

  const undo = useCallback(() => {
    if (!canUndo) return;
    
    isUndoRedoAction.current = true;
    const newIndex = historyIndex - 1;
    const state = history[newIndex];
    
    setShapes(JSON.parse(JSON.stringify(state.shapes)));
    base64ToImageData(state.penStrokesData, (data) => {
      setPenStrokes(data);
    });
    setHistoryIndex(newIndex);
    setSelectedShape(null);
    setIsMoveMode(false);
    toast.success('Undo');
  }, [canUndo, historyIndex, history, base64ToImageData]);

  const redo = useCallback(() => {
    if (!canRedo) return;
    
    isUndoRedoAction.current = true;
    const newIndex = historyIndex + 1;
    const state = history[newIndex];
    
    setShapes(JSON.parse(JSON.stringify(state.shapes)));
    base64ToImageData(state.penStrokesData, (data) => {
      setPenStrokes(data);
    });
    setHistoryIndex(newIndex);
    setSelectedShape(null);
    setIsMoveMode(false);
    toast.success('Redo');
  }, [canRedo, historyIndex, history, base64ToImageData]);

  const getResizeHandles = (shape: Shape) => {
    const { x, y, width, height } = shape;
    return {
      nw: { x: x - HANDLE_SIZE / 2, y: y - HANDLE_SIZE / 2 },
      ne: { x: x + width - HANDLE_SIZE / 2, y: y - HANDLE_SIZE / 2 },
      sw: { x: x - HANDLE_SIZE / 2, y: y + height - HANDLE_SIZE / 2 },
      se: { x: x + width - HANDLE_SIZE / 2, y: y + height - HANDLE_SIZE / 2 },
    };
  };

  const getRotationHandle = (shape: Shape) => {
    const { x, y, width } = shape;
    return {
      x: x + width / 2 - HANDLE_SIZE / 2,
      y: y - ROTATION_HANDLE_DISTANCE - HANDLE_SIZE / 2
    };
  };

  const findResizeHandle = (x: number, y: number, shape: Shape): ResizeHandle => {
    // Check rotation handle first
    const rotHandle = getRotationHandle(shape);
    if (x >= rotHandle.x && x <= rotHandle.x + HANDLE_SIZE && y >= rotHandle.y && y <= rotHandle.y + HANDLE_SIZE) {
      return 'rotate';
    }
    
    const handles = getResizeHandles(shape);
    for (const [key, pos] of Object.entries(handles)) {
      if (x >= pos.x && x <= pos.x + HANDLE_SIZE && y >= pos.y && y <= pos.y + HANDLE_SIZE) {
        return key as ResizeHandle;
      }
    }
    return null;
  };

  const drawShape = useCallback((ctx: CanvasRenderingContext2D, shape: Shape, isSelected: boolean = false) => {
    const { x, y, width, height, rotation = 0 } = shape;
    const centerX = x + width / 2;
    const centerY = y + height / 2;

    ctx.save();
    
    // Apply rotation around center
    if (rotation !== 0) {
      ctx.translate(centerX, centerY);
      ctx.rotate(rotation);
      ctx.translate(-centerX, -centerY);
    }

    ctx.strokeStyle = shape.color;
    ctx.lineWidth = shape.brushSize;
    ctx.lineCap = 'round';

    if (shape.fill) {
      ctx.fillStyle = shape.color;
    }

    ctx.beginPath();

    switch (shape.type) {
      case 'text':
        ctx.font = `${shape.fontSize || 24}px ${shape.fontFamily || 'sans-serif'}`;
        ctx.fillStyle = shape.color;
        ctx.fillText(shape.text || '', x, y + (shape.fontSize || 24));
        break;
      case 'rectangle':
        if (shape.fill) ctx.fillRect(x, y, width, height);
        ctx.strokeRect(x, y, width, height);
        break;
      case 'circle':
        const radius = Math.sqrt(width * width + height * height) / 2;
        ctx.arc(x + width / 2, y + height / 2, radius, 0, 2 * Math.PI);
        if (shape.fill) ctx.fill();
        ctx.stroke();
        break;
      case 'line':
        ctx.moveTo(x, y);
        ctx.lineTo(x + width, y + height);
        ctx.stroke();
        break;
      case 'triangle':
        ctx.moveTo(x + width / 2, y);
        ctx.lineTo(x, y + height);
        ctx.lineTo(x + width, y + height);
        ctx.closePath();
        if (shape.fill) ctx.fill();
        ctx.stroke();
        break;
      case 'arrow':
        const headlen = 15;
        const angle = Math.atan2(height, width);
        ctx.moveTo(x, y);
        ctx.lineTo(x + width, y + height);
        ctx.lineTo(x + width - headlen * Math.cos(angle - Math.PI / 6), y + height - headlen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(x + width, y + height);
        ctx.lineTo(x + width - headlen * Math.cos(angle + Math.PI / 6), y + height - headlen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
        break;
      case 'star':
        const starRadius = Math.sqrt(width * width + height * height) / 2;
        const spikes = 5;
        const outerRadius = starRadius;
        const innerRadius = starRadius / 2;
        const starCenterX = x + width / 2;
        const starCenterY = y + height / 2;
        for (let i = 0; i < spikes * 2; i++) {
          const currentRadius = i % 2 === 0 ? outerRadius : innerRadius;
          const starAngle = (i * Math.PI) / spikes - Math.PI / 2;
          const xPos = starCenterX + currentRadius * Math.cos(starAngle);
          const yPos = starCenterY + currentRadius * Math.sin(starAngle);
          if (i === 0) ctx.moveTo(xPos, yPos);
          else ctx.lineTo(xPos, yPos);
        }
        ctx.closePath();
        if (shape.fill) ctx.fill();
        ctx.stroke();
        break;
      case 'hexagon':
        const hexRadius = Math.sqrt(width * width + height * height) / 2;
        const hexCenterX = x + width / 2;
        const hexCenterY = y + height / 2;
        for (let i = 0; i < 6; i++) {
          const hexAngle = (i * 2 * Math.PI) / 6 - Math.PI / 2;
          const xPos = hexCenterX + hexRadius * Math.cos(hexAngle);
          const yPos = hexCenterY + hexRadius * Math.sin(hexAngle);
          if (i === 0) ctx.moveTo(xPos, yPos);
          else ctx.lineTo(xPos, yPos);
        }
        ctx.closePath();
        if (shape.fill) ctx.fill();
        ctx.stroke();
        break;
      case 'pentagon':
        const pentRadius = Math.sqrt(width * width + height * height) / 2;
        const pentCenterX = x + width / 2;
        const pentCenterY = y + height / 2;
        for (let i = 0; i < 5; i++) {
          const pentAngle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
          const xPos = pentCenterX + pentRadius * Math.cos(pentAngle);
          const yPos = pentCenterY + pentRadius * Math.sin(pentAngle);
          if (i === 0) ctx.moveTo(xPos, yPos);
          else ctx.lineTo(xPos, yPos);
        }
        ctx.closePath();
        if (shape.fill) ctx.fill();
        ctx.stroke();
        break;
      case 'octagon':
        const octRadius = Math.sqrt(width * width + height * height) / 2;
        const octCenterX = x + width / 2;
        const octCenterY = y + height / 2;
        for (let i = 0; i < 8; i++) {
          const octAngle = (i * 2 * Math.PI) / 8 - Math.PI / 2;
          const xPos = octCenterX + octRadius * Math.cos(octAngle);
          const yPos = octCenterY + octRadius * Math.sin(octAngle);
          if (i === 0) ctx.moveTo(xPos, yPos);
          else ctx.lineTo(xPos, yPos);
        }
        ctx.closePath();
        if (shape.fill) ctx.fill();
        ctx.stroke();
        break;
      case 'diamond':
        ctx.moveTo(x + width / 2, y);
        ctx.lineTo(x + width, y + height / 2);
        ctx.lineTo(x + width / 2, y + height);
        ctx.lineTo(x, y + height / 2);
        ctx.closePath();
        if (shape.fill) ctx.fill();
        ctx.stroke();
        break;
      case 'heart':
        const topCurveHeight = height * 0.3;
        ctx.moveTo(x + width / 2, y + topCurveHeight);
        ctx.bezierCurveTo(x + width / 2, y, x, y, x, y + topCurveHeight);
        ctx.bezierCurveTo(x, y + (height + topCurveHeight) / 2, x + width / 2, y + (height + topCurveHeight) / 2, x + width / 2, y + height);
        ctx.bezierCurveTo(x + width / 2, y + (height + topCurveHeight) / 2, x + width, y + (height + topCurveHeight) / 2, x + width, y + topCurveHeight);
        ctx.bezierCurveTo(x + width, y, x + width / 2, y, x + width / 2, y + topCurveHeight);
        if (shape.fill) ctx.fill();
        ctx.stroke();
        break;
    }

    if (isSelected) {
      // Draw subtle selection border (like image selection in notes)
      ctx.strokeStyle = 'hsl(221, 83%, 53%)'; // Primary blue color
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.strokeRect(x - 4, y - 4, width + 8, height + 8);

      // Draw circular resize handles (like image resize handle style)
      const handles = getResizeHandles(shape);
      
      // Draw only corner handles as circles
      Object.entries(handles).forEach(([key, pos]) => {
        ctx.beginPath();
        ctx.arc(pos.x + HANDLE_SIZE / 2, pos.y + HANDLE_SIZE / 2, HANDLE_SIZE / 2 + 2, 0, 2 * Math.PI);
        ctx.fillStyle = 'hsl(221, 83%, 53%)'; // Primary blue
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      // Draw rotation handle with rotation icon style
      const rotHandle = getRotationHandle(shape);
      ctx.beginPath();
      ctx.arc(rotHandle.x + HANDLE_SIZE / 2, rotHandle.y + HANDLE_SIZE / 2, HANDLE_SIZE / 2 + 3, 0, 2 * Math.PI);
      ctx.fillStyle = 'hsl(221, 83%, 53%)'; // Primary blue
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Draw rotation arrow icon inside the handle
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const rcx = rotHandle.x + HANDLE_SIZE / 2;
      const rcy = rotHandle.y + HANDLE_SIZE / 2;
      ctx.arc(rcx, rcy, 4, -Math.PI * 0.7, Math.PI * 0.3);
      ctx.stroke();
      // Arrow head
      ctx.beginPath();
      ctx.moveTo(rcx + 3, rcy - 3);
      ctx.lineTo(rcx + 5, rcy - 1);
      ctx.lineTo(rcx + 2, rcy);
      ctx.stroke();
      
      // Draw subtle dashed line from shape to rotation handle
      ctx.beginPath();
      ctx.strokeStyle = 'hsl(221, 83%, 53%, 0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.moveTo(x + width / 2, y - 4);
      ctx.lineTo(rotHandle.x + HANDLE_SIZE / 2, rotHandle.y + HANDLE_SIZE);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }, []);

  // Map blend mode to canvas globalCompositeOperation
  const getCompositeOperation = (blendMode: import('./SketchLayerPanel').BlendMode): GlobalCompositeOperation => {
    switch (blendMode) {
      case 'multiply': return 'multiply';
      case 'screen': return 'screen';
      case 'overlay': return 'overlay';
      case 'darken': return 'darken';
      case 'lighten': return 'lighten';
      default: return 'source-over';
    }
  };

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Sort layers by order (lowest order = bottom)
    const sortedLayers = [...layers].sort((a, b) => a.order - b.order);

    // Draw each layer in order
    sortedLayers.forEach(layer => {
      if (!layer.visible) return;

      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.globalCompositeOperation = getCompositeOperation(layer.blendMode);

      // Draw pen strokes for this layer
      if (layer.id === activeLayerId && penStrokes) {
        ctx.putImageData(penStrokes, 0, 0);
      } else if (layerStrokes[layer.id]) {
        ctx.putImageData(layerStrokes[layer.id]!, 0, 0);
      }

      // Draw shapes for this layer
      const layerShapes = shapes.filter(s => s.layerId === layer.id);
      layerShapes.forEach(shape => {
        drawShape(ctx, shape, selectedShape?.id === shape.id);
      });

      ctx.restore();
    });

    // Draw shapes without layerId (legacy/migration support)
    const orphanShapes = shapes.filter(s => !s.layerId);
    orphanShapes.forEach(shape => {
      drawShape(ctx, shape, selectedShape?.id === shape.id);
    });

    // Draw symmetry guides if enabled
    if (symmetryEnabled && guidesEnabled) {
      ctx.save();
      ctx.strokeStyle = '#0088ff44';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      if (symmetryMode === 'vertical') {
        ctx.beginPath();
        ctx.moveTo(centerX, 0);
        ctx.lineTo(centerX, rect.height);
        ctx.stroke();
      } else if (symmetryMode === 'horizontal') {
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(rect.width, centerY);
        ctx.stroke();
      } else if (symmetryMode === 'radial') {
        for (let i = 0; i < symmetrySegments; i++) {
          const angle = (i * 2 * Math.PI) / symmetrySegments;
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.lineTo(
            centerX + Math.cos(angle) * Math.max(rect.width, rect.height),
            centerY + Math.sin(angle) * Math.max(rect.width, rect.height)
          );
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  }, [shapes, selectedShape, drawShape, penStrokes, layers, activeLayerId, layerStrokes, symmetryEnabled, symmetryMode, symmetrySegments, guidesEnabled]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';

    if (content) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
      };
      img.src = content;
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, rect.width, rect.height);
    }
  }, [content]);

  // Keyboard shortcuts for delete and undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Delete selected shape with Delete or Backspace in any tool mode
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedShape) {
        // Don't delete if user is typing in an input
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        deleteSelectedShape();
      }
      // Escape to deselect
      if (e.key === 'Escape') {
        setSelectedShape(null);
        setIsMoveMode(false);
        setTextInputPos(null);
      }
      // Ctrl/Cmd + Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y for redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedShape, undo, redo]);

  const isPointInShape = (x: number, y: number, shape: Shape): boolean => {
    return x >= shape.x && x <= shape.x + shape.width && y >= shape.y && y <= shape.y + shape.height;
  };

  const findShapeAtPoint = (x: number, y: number): Shape | null => {
    for (let i = shapes.length - 1; i >= 0; i--) {
      if (isPointInShape(x, y, shapes[i])) {
        return shapes[i];
      }
    }
    return null;
  };

  const deleteSelectedShape = () => {
    if (!selectedShape) return;
    const newShapes = shapes.filter(s => s.id !== selectedShape.id);
    setShapes(newShapes);
    setSelectedShape(null);
    setIsMoveMode(false);
    saveToHistory(newShapes, penStrokes);
    toast.success('Shape deleted');
    
    const canvas = canvasRef.current;
    if (canvas) {
      setTimeout(() => {
        onChange(canvas.toDataURL());
      }, 50);
    }
  };

  const changeSelectedShapeColor = (newColor: string) => {
    if (!selectedShape) return;
    const updatedShape = { ...selectedShape, color: newColor };
    const updatedShapes = shapes.map(s => s.id === selectedShape.id ? updatedShape : s);
    setShapes(updatedShapes);
    setSelectedShape(updatedShape);
    saveToHistory(updatedShapes, penStrokes);
    
    const canvas = canvasRef.current;
    if (canvas) {
      setTimeout(() => {
        onChange(canvas.toDataURL());
      }, 50);
    }
  };

  const addTextShape = (x: number, y: number, text: string) => {
    if (!text.trim()) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    
    // Measure text width
    ctx.font = `${fontSize}px ${fontFamily}`;
    const metrics = ctx.measureText(text);
    
    const newShape: Shape = {
      id: Date.now().toString(),
      type: 'text',
      x,
      y,
      width: metrics.width + 10,
      height: fontSize + 10,
      color,
      brushSize,
      fill: false,
      text,
      fontSize,
      fontFamily,
      layerId: activeLayerId
    };
    
    const newShapes = [...shapes, newShape];
    setShapes(newShapes);
    saveToHistory(newShapes, penStrokes);
    
    if (canvas) {
      setTimeout(() => {
        onChange(canvas.toDataURL());
      }, 50);
    }
  };

  const updateTextShape = (shapeId: string, newText: string) => {
    if (!newText.trim()) {
      // Delete the shape if text is empty
      const newShapes = shapes.filter(s => s.id !== shapeId);
      setShapes(newShapes);
      setSelectedShape(null);
      saveToHistory(newShapes, penStrokes);
    } else {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx) return;
      
      const shape = shapes.find(s => s.id === shapeId);
      if (!shape) return;
      
      ctx.font = `${shape.fontSize || 24}px ${shape.fontFamily || 'sans-serif'}`;
      const metrics = ctx.measureText(newText);
      
      const updatedShape = { 
        ...shape, 
        text: newText, 
        width: metrics.width + 10 
      };
      const updatedShapes = shapes.map(s => s.id === shapeId ? updatedShape : s);
      setShapes(updatedShapes);
      if (selectedShape?.id === shapeId) {
        setSelectedShape(updatedShape);
      }
      saveToHistory(updatedShapes, penStrokes);
    }
    
    const canvas = canvasRef.current;
    if (canvas) {
      setTimeout(() => {
        onChange(canvas.toDataURL());
      }, 50);
    }
  };

  const handleTextInputSubmit = () => {
    if (editingTextShape) {
      // Editing existing text
      updateTextShape(editingTextShape.id, textInputValue);
      setEditingTextShape(null);
    } else if (textInputPos && textInputValue.trim()) {
      // Adding new text
      addTextShape(textInputPos.x, textInputPos.y, textInputValue);
    }
    setTextInputPos(null);
    setTextInputValue('');
  };

  const startEditingText = (shape: Shape) => {
    if (shape.type !== 'text') return;
    setEditingTextShape(shape);
    setTextInputPos({ x: shape.x, y: shape.y });
    setTextInputValue(shape.text || '');
    setTimeout(() => textInputRef.current?.focus(), 0);
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    try {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;

      // Check if active layer is locked
      if (isActiveLayerLocked) {
        toast.error('Layer is locked');
        return;
      }

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    // Check for double-click on text shape to edit
    const now = Date.now();
    const shapeAtPoint = findShapeAtPoint(x, y);
    if (shapeAtPoint && shapeAtPoint.type === 'text') {
      if (
        lastClickShape.current === shapeAtPoint.id &&
        now - lastClickTime.current < 400
      ) {
        // Double-click detected - edit text
        startEditingText(shapeAtPoint);
        lastClickTime.current = 0;
        lastClickShape.current = null;
        return;
      }
      lastClickTime.current = now;
      lastClickShape.current = shapeAtPoint.id;
    } else {
      lastClickTime.current = 0;
      lastClickShape.current = null;
    }

    // Handle text tool - show input at click position
    if (tool === 'text') {
      setEditingTextShape(null);
      setTextInputPos({ x, y });
      setTextInputValue('');
      setTimeout(() => textInputRef.current?.focus(), 0);
      return;
    }

    // Check if clicking on a shape to select it, or long-press to move it
    const clickedShape = findShapeAtPoint(x, y);

    const beginShapeHold = (shape: Shape) => {
      // Tap selects only; moving happens after a hold/long-press
      setSelectedShape(shape);
      setIsMoveMode(false);
      redrawCanvas();

      clearShapeHoldTimer();
      shapeHoldPendingRef.current = true;
      shapeHoldActivatedRef.current = false;
      shapeHoldShapeIdRef.current = shape.id;
      shapeHoldStartClientRef.current = 'touches' in e
        ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
        : { x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY };
      shapeHoldStartCanvasRef.current = { x, y };

      shapeHoldTimerRef.current = window.setTimeout(() => {
        // If user is still holding the same shape, enable move mode and disable drawing
        if (!shapeHoldPendingRef.current) return;
        if (shapeHoldShapeIdRef.current !== shape.id) return;

        shapeHoldActivatedRef.current = true;
        setIsMoveMode(true);
        setDragOffset({ x: x - shape.x, y: y - shape.y });
        setIsDrawing(true);
      }, SHAPE_HOLD_DELAY_MS);
    };

    // If we have a selected shape, check for resize/rotation handles first
    if (selectedShape) {
      const handle = findResizeHandle(x, y, selectedShape);
      if (handle) {
        clearShapeHoldTimer();
        shapeHoldActivatedRef.current = false;
        setResizeHandle(handle);
        setInitialShapeState({ ...selectedShape });
        setStartPos({ x, y });
        setIsDrawing(true);
        return;
      }

      // Inside selected shape: start hold-to-move
      if (isPointInShape(x, y, selectedShape) && tool !== 'eraser') {
        // If move mode is already enabled (from toolbar), start moving immediately
        if (isMoveMode) {
          setDragOffset({ x: x - selectedShape.x, y: y - selectedShape.y });
          shapeHoldActivatedRef.current = true;
          setIsDrawing(true);
          return;
        }
        beginShapeHold(selectedShape);
        return;
      }
    }

    // Tapping any other shape: select it; long-press to move (or immediate move if move tool selected)
    if (clickedShape && tool !== 'eraser') {
      // If move mode is enabled from toolbar
      if (isMoveMode) {
        // If clicking on the already selected shape, start dragging
        if (selectedShape && selectedShape.id === clickedShape.id) {
          setDragOffset({ x: x - clickedShape.x, y: y - clickedShape.y });
          shapeHoldActivatedRef.current = true;
          setIsDrawing(true);
        } else {
          // First click - just select the shape
          setSelectedShape(clickedShape);
          redrawCanvas();
        }
        return;
      }
      beginShapeHold(clickedShape);
      return;
    }

    // If in move mode but didn't click a shape, just deselect without starting to draw
    if (isMoveMode) {
      if (selectedShape) {
        setSelectedShape(null);
      }
      return;
    }

    // Clear selection when starting to draw elsewhere
    if (selectedShape) {
      setSelectedShape(null);
      setIsMoveMode(false);
    }

    setIsDrawing(true);
    setLastPos({ x, y });
    setStartPos({ x, y });

    if (tool !== 'pen' && tool !== 'eraser') {
      setTempCanvas(ctx.getImageData(0, 0, canvas.width, canvas.height));
    }
    } catch (error) {
      console.error('Error in startDrawing:', error);
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    try {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    // If a hold is pending, cancel it if the user moves too much (then allow normal drawing)
    if (shapeHoldPendingRef.current && !shapeHoldActivatedRef.current) {
      const startClient = shapeHoldStartClientRef.current;
      const startCanvas = shapeHoldStartCanvasRef.current;
      const client = 'touches' in e
        ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
        : { x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY };

      if (startClient && startCanvas) {
        const dx = Math.abs(client.x - startClient.x);
        const dy = Math.abs(client.y - startClient.y);
        if (dx > 10 || dy > 10) {
          clearShapeHoldTimer();
          shapeHoldActivatedRef.current = false;

          // Start normal drawing from the original touch point
          setIsDrawing(true);
          setLastPos({ x: startCanvas.x, y: startCanvas.y });
          setStartPos({ x: startCanvas.x, y: startCanvas.y });

          if (tool !== 'pen' && tool !== 'eraser') {
            setTempCanvas(ctx.getImageData(0, 0, canvas.width, canvas.height));
          }
        }
      }
    }

    // Move shape ONLY after hold activated (drawing is disabled during hold)
    if (shapeHoldActivatedRef.current && isMoveMode && selectedShape && dragOffset) {
      const updatedShapes = shapes.map(s =>
        s.id === selectedShape.id
          ? { ...s, x: x - dragOffset.x, y: y - dragOffset.y }
          : s
      );
      setShapes(updatedShapes);
      setSelectedShape({ ...selectedShape, x: x - dragOffset.x, y: y - dragOffset.y });
      redrawCanvas();
      return;
    }

    if (!isDrawing) return;

    // Handle resizing and rotation
    if (resizeHandle && selectedShape && initialShapeState && startPos) {
      if (resizeHandle === 'rotate') {
        // Calculate rotation angle
        const centerX = selectedShape.x + selectedShape.width / 2;
        const centerY = selectedShape.y + selectedShape.height / 2;
        const angle = Math.atan2(y - centerY, x - centerX) + Math.PI / 2;
        
        const updatedShape = { ...selectedShape, rotation: angle };
        const updatedShapes = shapes.map(s => s.id === selectedShape.id ? updatedShape : s);
        setShapes(updatedShapes);
        setSelectedShape(updatedShape);
        redrawCanvas();
        return;
      }
      
      let newX = selectedShape.x;
      let newY = selectedShape.y;
      let newWidth = selectedShape.width;
      let newHeight = selectedShape.height;

      const deltaX = x - startPos.x;
      const deltaY = y - startPos.y;

      switch (resizeHandle) {
        case 'nw':
          newX = initialShapeState.x + deltaX;
          newY = initialShapeState.y + deltaY;
          newWidth = initialShapeState.width - deltaX;
          newHeight = initialShapeState.height - deltaY;
          break;
        case 'ne':
          newY = initialShapeState.y + deltaY;
          newWidth = initialShapeState.width + deltaX;
          newHeight = initialShapeState.height - deltaY;
          break;
        case 'sw':
          newX = initialShapeState.x + deltaX;
          newWidth = initialShapeState.width - deltaX;
          newHeight = initialShapeState.height + deltaY;
          break;
        case 'se':
          newWidth = initialShapeState.width + deltaX;
          newHeight = initialShapeState.height + deltaY;
          break;
      }

      // Ensure minimum size
      if (newWidth < 10) {
        newWidth = 10;
        if (resizeHandle === 'nw' || resizeHandle === 'sw') {
          newX = initialShapeState.x + initialShapeState.width - 10;
        }
      }
      if (newHeight < 10) {
        newHeight = 10;
        if (resizeHandle === 'nw' || resizeHandle === 'ne') {
          newY = initialShapeState.y + initialShapeState.height - 10;
        }
      }

      const updatedShape = { ...selectedShape, x: newX, y: newY, width: newWidth, height: newHeight };
      const updatedShapes = shapes.map(s => s.id === selectedShape.id ? updatedShape : s);
      setShapes(updatedShapes);
      setSelectedShape(updatedShape);
      redrawCanvas();
      return;
    }

    if (!lastPos || !startPos) return;

    if (tool === 'pen' || tool === 'eraser') {
      // Calculate velocity for pressure simulation
      const velocity = calculateVelocity(x, y);
      const currentBrushSettings = getEffectiveBrushSettings(velocity);
      const effectiveSize = tool === 'pen' ? currentBrushSettings.size : brushSize * 4;
      
      ctx.globalAlpha = tool === 'pen' ? currentBrushSettings.opacity : 1;
      
      // Get canvas dimensions for symmetry
      const rect = canvas.getBoundingClientRect();
      const points = getSymmetryPoints(x, y, rect.width, rect.height);
      const lastPoints = lastPos ? getSymmetryPoints(lastPos.x, lastPos.y, rect.width, rect.height) : null;
      
      // Draw at all symmetry points
      points.forEach((point, index) => {
        const lastPoint = lastPoints ? lastPoints[index] : null;
        
        if (currentBrushSettings.texture === 'spray' && tool === 'pen') {
          // Spray/airbrush effect
          const density = Math.ceil(effectiveSize * 2);
          for (let i = 0; i < density; i++) {
            const offsetX = (Math.random() - 0.5) * effectiveSize * 2;
            const offsetY = (Math.random() - 0.5) * effectiveSize * 2;
            const distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
            if (distance < effectiveSize) {
              ctx.beginPath();
              ctx.arc(point.x + offsetX, point.y + offsetY, Math.random() * 1.5, 0, Math.PI * 2);
              ctx.fillStyle = color;
              ctx.fill();
            }
          }
        } else if (currentBrushSettings.texture === 'dotted' && tool === 'pen') {
          // Textured pencil grain (continuous stroke + subtle speckles)
          if (lastPoint) {
            ctx.beginPath();
            ctx.moveTo(lastPoint.x, lastPoint.y);
            ctx.lineTo(point.x, point.y);
            ctx.strokeStyle = color;
            ctx.lineWidth = effectiveSize;
            ctx.lineCap = 'round';
            ctx.stroke();
          }

          const baseAlpha = currentBrushSettings.opacity;
          ctx.globalAlpha = baseAlpha * 0.15;
          const dots = Math.max(1, Math.ceil(effectiveSize / 6));
          for (let i = 0; i < dots; i++) {
            const offsetX = (Math.random() - 0.5) * effectiveSize * 0.7;
            const offsetY = (Math.random() - 0.5) * effectiveSize * 0.7;
            ctx.beginPath();
            ctx.arc(point.x + offsetX, point.y + offsetY, Math.random() * 0.6 + 0.2, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
          }
          ctx.globalAlpha = baseAlpha;
        } else if (currentBrushSettings.texture === 'rough' && tool === 'pen') {
          // Rough/textured stroke
          if (lastPoint) {
            const segments = 3;
            for (let i = 0; i < segments; i++) {
              const jitterX = (Math.random() - 0.5) * (1 - currentBrushSettings.hardness) * effectiveSize;
              const jitterY = (Math.random() - 0.5) * (1 - currentBrushSettings.hardness) * effectiveSize;
              ctx.beginPath();
              ctx.moveTo(lastPoint.x + jitterX, lastPoint.y + jitterY);
              ctx.lineTo(point.x + jitterX, point.y + jitterY);
              ctx.strokeStyle = color;
              ctx.lineWidth = effectiveSize * (0.5 + Math.random() * 0.5);
              ctx.lineCap = 'round';
              ctx.stroke();
            }
          }
        } else if (currentBrushSettings.texture === 'hatched' && tool === 'pen') {
          // Hatched/dry brush effect
          if (lastPoint) {
            const lines = Math.ceil(effectiveSize / 2);
            for (let i = 0; i < lines; i++) {
              const offset = (i - lines / 2) * 1.5;
              ctx.beginPath();
              ctx.moveTo(lastPoint.x + offset, lastPoint.y);
              ctx.lineTo(point.x + offset, point.y);
              ctx.strokeStyle = color;
              ctx.lineWidth = 0.5 + Math.random();
              ctx.lineCap = 'round';
              ctx.globalAlpha = currentBrushSettings.opacity * (0.3 + Math.random() * 0.7);
              ctx.stroke();
            }
            ctx.globalAlpha = currentBrushSettings.opacity;
          }
        } else {
          // Smooth stroke with hardness
          if (lastPoint) {
            ctx.beginPath();
            ctx.moveTo(lastPoint.x, lastPoint.y);
            ctx.lineTo(point.x, point.y);
            ctx.strokeStyle = tool === 'pen' ? color : '#ffffff';
            ctx.lineWidth = effectiveSize;
            ctx.lineCap = 'round';
            ctx.stroke();
            
            // Soft edge for low hardness
            if (currentBrushSettings.hardness < 0.8 && tool === 'pen') {
              ctx.globalAlpha = currentBrushSettings.opacity * 0.3;
              ctx.lineWidth = effectiveSize * 1.3;
              ctx.stroke();
              ctx.globalAlpha = currentBrushSettings.opacity;
            }
          }
        }
      });
      
      ctx.globalAlpha = 1;
      setLastPos({ x, y });
    } else {
      if (tempCanvas) {
        ctx.putImageData(tempCanvas, 0, 0);
      }

      shapes.forEach(shape => drawShape(ctx, shape, false));

      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';

      if (fillEnabled) {
        ctx.fillStyle = color;
      }

      const shapeX = Math.min(startPos.x, x);
      const shapeY = Math.min(startPos.y, y);
      const shapeWidth = Math.abs(x - startPos.x);
      const shapeHeight = Math.abs(y - startPos.y);

      const previewShape: Shape = {
        id: 'preview',
        type: tool as Shape['type'],
        x: shapeX,
        y: shapeY,
        width: shapeWidth,
        height: shapeHeight,
        color,
        brushSize,
        fill: fillEnabled,
        layerId: activeLayerId
      };

      drawShape(ctx, previewShape, false);
    }
    } catch (error) {
      console.error('Error in draw function:', error);
    }
  };

  const stopDrawing = () => {
    try {
      // Stop any pending/active shape hold
      clearShapeHoldTimer();
      shapeHoldActivatedRef.current = false;
      shapeHoldShapeIdRef.current = null;
      shapeHoldStartClientRef.current = null;
      shapeHoldStartCanvasRef.current = null;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');

    // If we were dragging a shape via hold-to-move, save history but keep selection
    if (isMoveMode && selectedShape && dragOffset) {
      if (canvas && ctx) {
        saveToHistory(shapes, penStrokes);
        onChange(canvas.toDataURL());
      }
      setDragOffset(null);
      setIsDrawing(false);
      return;
    }

    if (isDrawing) {
      if (canvas && ctx) {
        // Handle resize/rotation
        if (resizeHandle && selectedShape) {
          saveToHistory(shapes, penStrokes);
          setResizeHandle(null);
          setInitialShapeState(null);
          setIsDrawing(false);
          onChange(canvas.toDataURL());
          return;
        }
        
        if (tool === 'pen' || tool === 'eraser') {
          // Save history after pen/eraser stroke
          saveToHistory(shapes, penStrokes);
        } else if (startPos && lastPos) {
          const x = lastPos.x;
          const y = lastPos.y;
          const shapeX = Math.min(startPos.x, x);
          const shapeY = Math.min(startPos.y, y);
          const shapeWidth = Math.abs(x - startPos.x);
          const shapeHeight = Math.abs(y - startPos.y);

          if (shapeWidth > 5 || shapeHeight > 5) {
            const newShape: Shape = {
              id: Date.now().toString(),
              type: tool as Shape['type'],
              x: shapeX,
              y: shapeY,
              width: shapeWidth,
              height: shapeHeight,
              color,
              brushSize,
              fill: fillEnabled,
              layerId: activeLayerId
            };
            const newShapes = [...shapes, newShape];
            setShapes(newShapes);
            saveToHistory(newShapes, penStrokes);
          }
        }

        onChange(canvas.toDataURL());
      }
    }
    setIsDrawing(false);
    setLastPos(null);
    setStartPos(null);
    setResizeHandle(null);
    setInitialShapeState(null);
    
    // Update layer thumbnail after drawing stops
    if (penStrokes) {
      generateLayerThumbnail(penStrokes, activeLayerId);
    }
    } catch (error) {
      console.error('Error in stopDrawing:', error);
      setIsDrawing(false);
      setLastPos(null);
      setStartPos(null);
    }
  };

  useEffect(() => {
    if (shapes.length > 0 || selectedShape) {
      redrawCanvas();
    }
  }, [shapes, selectedShape, redrawCanvas]);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setShapes([]);
    setSelectedShape(null);
    setIsMoveMode(false);
    setPenStrokes(null);
    saveToHistory([], null);
    onChange(canvas.toDataURL());
  };

  const addCustomColor = () => {
    if (!newColor || customColors.includes(newColor)) {
      toast.error('Color already exists or invalid');
      return;
    }
    const updatedColors = [...customColors, newColor];
    setCustomColors(updatedColors);
    saveCustomColors(updatedColors);
    setColor(newColor);
    toast.success('Custom color added!');
  };

  const removeCustomColor = (colorToRemove: string) => {
    const updatedColors = customColors.filter(c => c !== colorToRemove);
    setCustomColors(updatedColors);
    saveCustomColors(updatedColors);
    toast.success('Color removed');
  };

  const isShapeTool = !['pen', 'eraser', 'line', 'arrow', 'text'].includes(tool);

  const getCursor = () => {
    if (isMoveMode) {
      if (resizeHandle === 'rotate') return 'grab';
      if (resizeHandle) return 'nwse-resize';
      return 'move';
    }
    if (tool === 'text') return 'text';
    return 'crosshair';
  };

  // Calculate action icons position
  const getActionIconsPosition = () => {
    if (!selectedShape) return null;
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    return {
      x: selectedShape.x + selectedShape.width / 2,
      y: selectedShape.y - 30
    };
  };

  const actionIconsPos = getActionIconsPosition();

  // Layer management functions
  const handleLayerSelect = useCallback((layerId: string) => {
    if (layerId === activeLayerId) return;
    
    // Save current layer's strokes before switching
    if (penStrokes) {
      setLayerStrokes(prev => ({
        ...prev,
        [activeLayerId]: penStrokes
      }));
    }
    
    // Load the new layer's strokes
    const newLayerStrokes = layerStrokes[layerId] || null;
    setPenStrokes(newLayerStrokes);
    
    setActiveLayerId(layerId);
  }, [activeLayerId, penStrokes, layerStrokes]);

  const handleLayerAdd = useCallback(() => {
    // Save current layer's strokes before adding new layer
    if (penStrokes) {
      setLayerStrokes(prev => ({
        ...prev,
        [activeLayerId]: penStrokes
      }));
    }
    
    const newLayer: SketchLayer = {
      id: 'layer-' + Date.now(),
      name: `Layer ${layers.length + 1}`,
      visible: true,
      locked: false,
      opacity: 1,
      order: layers.length,
      blendMode: 'normal'
    };
    const newLayers = [...layers, newLayer];
    setLayers(newLayers);
    setActiveLayerId(newLayer.id);
    setPenStrokes(null); // New layer starts empty
    toast.success('Layer added');
  }, [layers, penStrokes, activeLayerId]);

  const handleLayerDelete = useCallback((layerId: string) => {
    if (layers.length <= 1) {
      toast.error('Cannot delete the last layer');
      return;
    }
    
    // Save current layer strokes before potentially switching
    if (penStrokes && layerId !== activeLayerId) {
      setLayerStrokes(prev => ({
        ...prev,
        [activeLayerId]: penStrokes
      }));
    }
    
    // Remove shapes on this layer
    const newShapes = shapes.filter(s => s.layerId !== layerId);
    setShapes(newShapes);
    
    // Remove layer
    const newLayers = layers.filter(l => l.id !== layerId);
    setLayers(newLayers);
    
    // Clean up layer strokes
    const newLayerStrokes = { ...layerStrokes };
    delete newLayerStrokes[layerId];
    setLayerStrokes(newLayerStrokes);
    
    // Update active layer if needed and load its strokes
    if (activeLayerId === layerId) {
      const newActiveId = newLayers[newLayers.length - 1].id;
      setActiveLayerId(newActiveId);
      setPenStrokes(newLayerStrokes[newActiveId] || null);
    }
    
    saveToHistory(newShapes, penStrokes);
    toast.success('Layer deleted');
  }, [layers, shapes, activeLayerId, layerStrokes, penStrokes, saveToHistory]);

  const handleLayerRename = useCallback((layerId: string, newName: string) => {
    const newLayers = layers.map(l => 
      l.id === layerId ? { ...l, name: newName } : l
    );
    setLayers(newLayers);
  }, [layers]);

  const handleLayerToggleVisibility = useCallback((layerId: string) => {
    const newLayers = layers.map(l => 
      l.id === layerId ? { ...l, visible: !l.visible } : l
    );
    setLayers(newLayers);
  }, [layers]);

  const handleLayerToggleLock = useCallback((layerId: string) => {
    const layer = layers.find(l => l.id === layerId);
    if (layer) {
      const newLayers = layers.map(l => 
        l.id === layerId ? { ...l, locked: !l.locked } : l
      );
      setLayers(newLayers);
      toast.success(layer.locked ? 'Layer unlocked' : 'Layer locked');
    }
  }, [layers]);

  const handleLayerReorder = useCallback((layerId: string, direction: 'up' | 'down') => {
    const sortedLayers = [...layers].sort((a, b) => b.order - a.order);
    const currentIndex = sortedLayers.findIndex(l => l.id === layerId);
    
    if (direction === 'up' && currentIndex > 0) {
      const newLayers = [...sortedLayers];
      const temp = newLayers[currentIndex].order;
      newLayers[currentIndex].order = newLayers[currentIndex - 1].order;
      newLayers[currentIndex - 1].order = temp;
      setLayers(newLayers);
    } else if (direction === 'down' && currentIndex < sortedLayers.length - 1) {
      const newLayers = [...sortedLayers];
      const temp = newLayers[currentIndex].order;
      newLayers[currentIndex].order = newLayers[currentIndex + 1].order;
      newLayers[currentIndex + 1].order = temp;
      setLayers(newLayers);
    }
  }, [layers]);

  const handleLayerOpacityChange = useCallback((layerId: string, opacity: number) => {
    const newLayers = layers.map(l => 
      l.id === layerId ? { ...l, opacity } : l
    );
    setLayers(newLayers);
  }, [layers]);

  const handleLayerBlendModeChange = useCallback((layerId: string, blendMode: import('./SketchLayerPanel').BlendMode) => {
    const newLayers = layers.map(l => 
      l.id === layerId ? { ...l, blendMode } : l
    );
    setLayers(newLayers);
  }, [layers]);

  const handleLayerDuplicate = useCallback((layerId: string) => {
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;

    // Save current layer strokes before switching
    if (penStrokes) {
      setLayerStrokes(prev => ({
        ...prev,
        [activeLayerId]: penStrokes
      }));
    }

    const newLayerId = 'layer-' + Date.now();
    const newLayer: SketchLayer = {
      id: newLayerId,
      name: `${layer.name} (copy)`,
      visible: true,
      locked: false,
      opacity: layer.opacity,
      order: layers.length,
      blendMode: layer.blendMode
    };

    // Duplicate shapes on this layer
    const layerShapes = shapes.filter(s => s.layerId === layerId);
    const duplicatedShapes = layerShapes.map(s => ({
      ...s,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      layerId: newLayerId
    }));

    // Also duplicate the strokes for the new layer
    const sourceStrokes = layerId === activeLayerId ? penStrokes : layerStrokes[layerId];
    const updatedLayerStrokes = {
      ...layerStrokes,
      [activeLayerId]: penStrokes, // Save current
      [newLayerId]: sourceStrokes // Copy to new layer
    };
    setLayerStrokes(updatedLayerStrokes);

    const newLayers = [...layers, newLayer];
    const newShapes = [...shapes, ...duplicatedShapes];
    
    setLayers(newLayers);
    setShapes(newShapes);
    setActiveLayerId(newLayerId);
    setPenStrokes(sourceStrokes); // Load duplicated strokes
    
    saveToHistory(newShapes, sourceStrokes);
    toast.success('Layer duplicated');
  }, [layers, shapes, penStrokes, activeLayerId, layerStrokes, saveToHistory]);

  // Import image handler
  const handleImportImage = useCallback(() => {
    imageInputRef.current?.click();
  }, []);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        // Draw image centered on canvas
        const maxWidth = 400;
        const maxHeight = 400;
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }

        const x = (canvas.width / window.devicePixelRatio - width) / 2;
        const y = (canvas.height / window.devicePixelRatio - height) / 2;

        ctx.drawImage(img, x, y, width, height);
        onChange(canvas.toDataURL());
        toast.success('Image imported');
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    
    // Reset input
    if (e.target) e.target.value = '';
  }, [onChange]);

  // Get active layer
  const activeLayer = layers.find(l => l.id === activeLayerId);
  const isActiveLayerLocked = activeLayer?.locked ?? false;

  return (
    <div className={cn("flex flex-col h-full bg-background", autoHideToolbar && "group")}>
      {/* Hidden file input for image import */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />
      
      {/* Simplified horizontal scrollable toolbar */}
      <SketchToolbar
        currentTool={isMoveMode ? 'move' : tool as SketchTool}
        onToolSelect={(t) => { 
          if (t === 'move') {
            // Toggle move mode on/off
            if (isMoveMode) {
              setIsMoveMode(false);
              setSelectedShape(null);
            } else {
              setIsMoveMode(true);
            }
          } else {
            setTool(t as DrawTool); 
            setIsMoveMode(false); 
            setSelectedShape(null); 
            setSelectedBrush(null); 
          }
        }}
        currentColor={color}
        onColorSelect={setColor}
        brushSize={brushSize}
        onBrushSizeSelect={setBrushSize}
        fillEnabled={fillEnabled}
        onFillToggle={() => setFillEnabled(!fillEnabled)}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onClear={clearCanvas}
      />

      <div 
        ref={canvasContainerRef}
        className="flex-1 overflow-auto relative bg-muted/20 p-4"
      >
        <canvas
          ref={canvasRef}
          className={cn(
            "border border-border rounded-lg bg-white touch-none shadow-lg"
          )}
          style={{ 
            width: '100%',
            minWidth: '800px',
            height: '900px', 
            cursor: getCursor() 
          }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        
        {/* Text input overlay */}
        {textInputPos && (
          <div 
            className="absolute pointer-events-auto"
            style={{ 
              left: textInputPos.x + 16,
              top: textInputPos.y + 16 
            }}
          >
            <Input
              ref={textInputRef}
              value={textInputValue}
              onChange={(e) => setTextInputValue(e.target.value)}
              onBlur={handleTextInputSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleTextInputSubmit();
                } else if (e.key === 'Escape') {
                  setTextInputPos(null);
                  setTextInputValue('');
                }
              }}
              placeholder="Type text..."
              className="w-48 h-8 text-sm bg-white border-primary"
              autoFocus
            />
          </div>
        )}
        
        {/* Action icons for selected shape */}
        {selectedShape && actionIconsPos && !isMoveMode && (
          <div 
            className="absolute flex items-center gap-1 bg-white rounded-lg shadow-lg border p-1 pointer-events-auto"
            style={{ 
              left: actionIconsPos.x + 16 - 44,
              top: actionIconsPos.y + 16,
              zIndex: 10
            }}
          >
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => setIsMoveMode(true)}
              title="Move/Resize/Rotate shape"
            >
              <Move className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => {
                const updatedShape = { ...selectedShape, rotation: (selectedShape.rotation || 0) + Math.PI / 4 };
                const updatedShapes = shapes.map(s => s.id === selectedShape.id ? updatedShape : s);
                setShapes(updatedShapes);
                setSelectedShape(updatedShape);
                saveToHistory(updatedShapes, penStrokes);
              }}
              title="Rotate 45°"
            >
              <RotateCw className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={deleteSelectedShape}
              title="Delete shape"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
        
        {/* Move mode indicator with delete button */}
        {isMoveMode && selectedShape && (
          <div 
            className="absolute flex items-center gap-2 bg-primary text-primary-foreground rounded-lg shadow-lg px-2 py-1 pointer-events-auto"
            style={{ 
              left: (actionIconsPos?.x || 0) + 16 - 60,
              top: (actionIconsPos?.y || 0) + 16,
              zIndex: 10
            }}
          >
            <div className="flex items-center gap-1 text-xs">
              <Move className="h-3 w-3" />
              <span>Selected</span>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-primary-foreground hover:bg-destructive hover:text-destructive-foreground"
              onClick={deleteSelectedShape}
              title="Delete shape"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
