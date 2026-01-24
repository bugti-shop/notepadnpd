import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Move, Maximize2 } from 'lucide-react';

interface ResizableTableProps {
  tableHtml: string;
  initialWidth?: number;
  onUpdate?: (width: number, html: string) => void;
  className?: string;
}

export const ResizableTable = ({
  tableHtml,
  initialWidth = 100, // percentage
  onUpdate,
  className,
}: ResizableTableProps) => {
  const [width, setWidth] = useState(initialWidth);
  const [isResizing, setIsResizing] = useState(false);
  const [isSelected, setIsSelected] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startRef = useRef({ x: 0, width: 0 });

  // Handle resize
  const handleResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const containerWidth = containerRef.current?.parentElement?.clientWidth || 800;
    
    startRef.current = {
      x: clientX,
      width: (width / 100) * containerWidth,
    };
  }, [width]);

  const handleResizeMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isResizing || !containerRef.current?.parentElement) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const containerWidth = containerRef.current.parentElement.clientWidth;
    const deltaX = clientX - startRef.current.x;
    const newWidthPx = Math.max(200, Math.min(containerWidth, startRef.current.width + deltaX));
    const newWidthPercent = Math.round((newWidthPx / containerWidth) * 100);
    
    setWidth(newWidthPercent);
  }, [isResizing]);

  const handleResizeEnd = useCallback(() => {
    if (isResizing) {
      setIsResizing(false);
      onUpdate?.(width, tableHtml);
    }
  }, [isResizing, width, tableHtml, onUpdate]);

  // Add/remove event listeners
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      document.addEventListener('touchmove', handleResizeMove);
      document.addEventListener('touchend', handleResizeEnd);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
      document.removeEventListener('touchmove', handleResizeMove);
      document.removeEventListener('touchend', handleResizeEnd);
    };
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  // Click outside to deselect
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsSelected(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative my-4 select-none resizable-table-wrapper",
        isSelected && "ring-2 ring-primary ring-offset-2 rounded-lg",
        isResizing && "z-50",
        className
      )}
      style={{
        width: `${width}%`,
        cursor: isResizing ? 'ew-resize' : 'default',
      }}
      onClick={(e) => {
        e.stopPropagation();
        setIsSelected(true);
      }}
    >
      <div 
        dangerouslySetInnerHTML={{ __html: tableHtml }}
        className="table-content"
      />
      
      {isSelected && (
        <>
          {/* Left resize handle */}
          <div
            className="absolute top-1/2 -left-3 -translate-y-1/2 w-6 h-12 bg-primary/80 text-primary-foreground rounded-l-full flex items-center justify-center cursor-ew-resize shadow-lg hover:bg-primary transition-colors"
            onMouseDown={handleResizeStart}
            onTouchStart={handleResizeStart}
          >
            <div className="w-0.5 h-4 bg-primary-foreground/60 rounded-full" />
          </div>
          
          {/* Right resize handle */}
          <div
            className="absolute top-1/2 -right-3 -translate-y-1/2 w-6 h-12 bg-primary/80 text-primary-foreground rounded-r-full flex items-center justify-center cursor-ew-resize shadow-lg hover:bg-primary transition-colors"
            onMouseDown={handleResizeStart}
            onTouchStart={handleResizeStart}
          >
            <div className="w-0.5 h-4 bg-primary-foreground/60 rounded-full" />
          </div>
          
          {/* Width indicator */}
          <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 bg-background/95 text-foreground text-xs px-2 py-1 rounded shadow-md border">
            {width}% width
          </div>

          {/* Corner resize handle */}
          <div
            className="absolute -bottom-3 -right-3 w-7 h-7 bg-primary text-primary-foreground rounded-full flex items-center justify-center cursor-se-resize shadow-lg"
            onMouseDown={handleResizeStart}
            onTouchStart={handleResizeStart}
          >
            <Maximize2 className="h-4 w-4" />
          </div>
        </>
      )}
    </div>
  );
};

// Helper function to wrap table HTML with resizable container data attributes
export const wrapTableWithResizable = (tableHtml: string, width: number = 100): string => {
  return `<div class="resizable-table-container" data-table-width="${width}" contenteditable="false">${tableHtml}</div>`;
};

// Extract table HTML from resizable container
export const extractTableFromResizable = (containerHtml: string): { html: string; width: number } => {
  const widthMatch = containerHtml.match(/data-table-width="(\d+)"/);
  const width = widthMatch ? parseInt(widthMatch[1]) : 100;
  
  const tableMatch = containerHtml.match(/<table[\s\S]*?<\/table>/);
  const html = tableMatch ? tableMatch[0] : containerHtml;
  
  return { html, width };
};
