import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { triggerHaptic } from '@/utils/haptics';

interface PatternLockInputProps {
  onPatternComplete: (pattern: number[]) => void;
  disabled?: boolean;
  error?: boolean;
  size?: 'small' | 'medium' | 'large';
  showPath?: boolean;
}

interface Point {
  x: number;
  y: number;
  index: number;
}

export const PatternLockInput = ({
  onPatternComplete,
  disabled = false,
  error = false,
  size = 'medium',
  showPath = true,
}: PatternLockInputProps) => {
  const [selectedDots, setSelectedDots] = useState<number[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentLine, setCurrentLine] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dotPositions = useRef<Point[]>([]);

  // Grid size based on prop
  const gridSize = size === 'small' ? 180 : size === 'large' ? 280 : 240;
  const dotSize = size === 'small' ? 16 : size === 'large' ? 24 : 20;
  const selectedDotSize = size === 'small' ? 24 : size === 'large' ? 36 : 30;

  // Calculate dot positions on mount/resize
  useEffect(() => {
    const calculatePositions = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const cellSize = gridSize / 3;
      const positions: Point[] = [];
      
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          positions.push({
            x: rect.left + col * cellSize + cellSize / 2,
            y: rect.top + row * cellSize + cellSize / 2,
            index: row * 3 + col,
          });
        }
      }
      dotPositions.current = positions;
    };

    calculatePositions();
    window.addEventListener('resize', calculatePositions);
    return () => window.removeEventListener('resize', calculatePositions);
  }, [gridSize]);

  const getRelativePosition = (clientX: number, clientY: number) => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const findNearestDot = (clientX: number, clientY: number): number | null => {
    const threshold = gridSize / 5; // Detection radius
    
    for (const pos of dotPositions.current) {
      const distance = Math.sqrt(
        Math.pow(clientX - pos.x, 2) + Math.pow(clientY - pos.y, 2)
      );
      if (distance < threshold) {
        return pos.index;
      }
    }
    return null;
  };

  const handleStart = useCallback((clientX: number, clientY: number) => {
    if (disabled) return;
    
    setIsDrawing(true);
    setSelectedDots([]);
    
    const dotIndex = findNearestDot(clientX, clientY);
    if (dotIndex !== null) {
      setSelectedDots([dotIndex]);
      triggerHaptic('light');
    }
    
    const pos = getRelativePosition(clientX, clientY);
    if (pos) setCurrentLine(pos);
  }, [disabled]);

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!isDrawing || disabled) return;
    
    const pos = getRelativePosition(clientX, clientY);
    if (pos) setCurrentLine(pos);
    
    const dotIndex = findNearestDot(clientX, clientY);
    if (dotIndex !== null && !selectedDots.includes(dotIndex)) {
      setSelectedDots(prev => [...prev, dotIndex]);
      triggerHaptic('light');
    }
  }, [isDrawing, disabled, selectedDots]);

  const handleEnd = useCallback(() => {
    if (!isDrawing) return;
    
    setIsDrawing(false);
    setCurrentLine(null);
    
    if (selectedDots.length >= 4) {
      triggerHaptic('medium');
      onPatternComplete(selectedDots);
    } else if (selectedDots.length > 0) {
      triggerHaptic('heavy');
      // Pattern too short, reset
      setTimeout(() => setSelectedDots([]), 200);
    }
  }, [isDrawing, selectedDots, onPatternComplete]);

  // Touch handlers
  const onTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    handleStart(touch.clientX, touch.clientY);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    handleMove(touch.clientX, touch.clientY);
  };

  const onTouchEnd = () => handleEnd();

  // Mouse handlers
  const onMouseDown = (e: React.MouseEvent) => {
    handleStart(e.clientX, e.clientY);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    handleMove(e.clientX, e.clientY);
  };

  const onMouseUp = () => handleEnd();
  const onMouseLeave = () => {
    if (isDrawing) handleEnd();
  };

  // Get dot center position in container coordinates
  const getDotCenter = (index: number) => {
    const cellSize = gridSize / 3;
    const row = Math.floor(index / 3);
    const col = index % 3;
    return {
      x: col * cellSize + cellSize / 2,
      y: row * cellSize + cellSize / 2,
    };
  };

  // Reset pattern (exposed via effect)
  const resetPattern = useCallback(() => {
    setSelectedDots([]);
    setCurrentLine(null);
    setIsDrawing(false);
  }, []);

  // Reset on error
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        resetPattern();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [error, resetPattern]);

  // Direct tap handler for individual dots (Android WebView fix)
  const handleDotTap = (index: number, e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (disabled) return;
    
    if (!isDrawing) {
      // Start a new pattern
      setIsDrawing(true);
      setSelectedDots([index]);
      triggerHaptic('light');
    } else if (!selectedDots.includes(index)) {
      // Add to existing pattern
      setSelectedDots(prev => [...prev, index]);
      triggerHaptic('light');
    }
  };

  // Handle tap end on a dot
  const handleDotTapEnd = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Don't end drawing on dot tap - wait for container touch end
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative select-none",
        disabled && "opacity-50 pointer-events-none"
      )}
      style={{ 
        width: gridSize, 
        height: gridSize,
        touchAction: 'none',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
    >
      {/* SVG for connection lines */}
      {showPath && (
        <svg
          className="absolute inset-0 pointer-events-none"
          width={gridSize}
          height={gridSize}
          style={{ zIndex: 1 }}
        >
          {/* Lines between selected dots */}
          {selectedDots.map((dotIndex, i) => {
            if (i === 0) return null;
            const prevDot = getDotCenter(selectedDots[i - 1]);
            const currDot = getDotCenter(dotIndex);
            return (
              <line
                key={`line-${i}`}
                x1={prevDot.x}
                y1={prevDot.y}
                x2={currDot.x}
                y2={currDot.y}
                stroke={error ? "hsl(var(--destructive))" : "hsl(var(--primary))"}
                strokeWidth={3}
                strokeLinecap="round"
                className="transition-colors duration-200"
              />
            );
          })}
          
          {/* Current drawing line */}
          {isDrawing && currentLine && selectedDots.length > 0 && (
            <line
              x1={getDotCenter(selectedDots[selectedDots.length - 1]).x}
              y1={getDotCenter(selectedDots[selectedDots.length - 1]).y}
              x2={currentLine.x}
              y2={currentLine.y}
              stroke="hsl(var(--primary) / 0.5)"
              strokeWidth={2}
              strokeLinecap="round"
            />
          )}
        </svg>
      )}

      {/* 3x3 Grid of dots - each dot is individually tappable */}
      <div 
        className="absolute inset-0 grid grid-cols-3 grid-rows-3"
        style={{ zIndex: 2 }}
      >
        {Array.from({ length: 9 }).map((_, index) => {
          const isSelected = selectedDots.includes(index);
          const order = selectedDots.indexOf(index);
          
          return (
            <div
              key={index}
              className="flex items-center justify-center"
              style={{ 
                touchAction: 'none',
                WebkitTapHighlightColor: 'transparent',
              }}
              onTouchStart={(e) => handleDotTap(index, e)}
              onTouchEnd={handleDotTapEnd}
              onMouseDown={(e) => {
                e.preventDefault();
                handleDotTap(index, e);
              }}
            >
              <div
                className={cn(
                  "rounded-full transition-all duration-150 cursor-pointer",
                  "active:scale-125",
                  isSelected
                    ? error
                      ? "bg-destructive"
                      : "bg-primary scale-110"
                    : "bg-muted-foreground/40 hover:bg-muted-foreground/60"
                )}
                style={{
                  width: isSelected ? selectedDotSize : dotSize,
                  height: isSelected ? selectedDotSize : dotSize,
                  minWidth: dotSize,
                  minHeight: dotSize,
                  touchAction: 'none',
                }}
              >
                {/* Order indicator */}
                {isSelected && order >= 0 && (
                  <div className={cn(
                    "w-full h-full flex items-center justify-center",
                    "text-primary-foreground text-xs font-bold"
                  )}>
                    {order + 1}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Minimum pattern hint */}
      {selectedDots.length > 0 && selectedDots.length < 4 && isDrawing && (
        <div className="absolute -bottom-8 left-0 right-0 text-center text-xs text-muted-foreground">
          Connect at least 4 dots
        </div>
      )}
    </div>
  );
};
