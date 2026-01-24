import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Layers, 
  Eye, 
  EyeOff, 
  Lock, 
  Unlock, 
  Trash2, 
  Plus, 
  ChevronUp, 
  ChevronDown,
  Edit2,
  Check,
  X,
  Copy,
  Move
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten';

export interface SketchLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  order: number;
  blendMode: BlendMode;
}

interface SketchLayerPanelProps {
  layers: SketchLayer[];
  activeLayerId: string;
  onLayerSelect: (layerId: string) => void;
  onLayerAdd: () => void;
  onLayerDelete: (layerId: string) => void;
  onLayerRename: (layerId: string, newName: string) => void;
  onLayerToggleVisibility: (layerId: string) => void;
  onLayerToggleLock: (layerId: string) => void;
  onLayerReorder: (layerId: string, direction: 'up' | 'down') => void;
  onLayerOpacityChange: (layerId: string, opacity: number) => void;
  onLayerDuplicate: (layerId: string) => void;
  onLayerBlendModeChange: (layerId: string, blendMode: BlendMode) => void;
  layerThumbnails?: { [layerId: string]: string | null };
}

export const SketchLayerPanel = ({
  layers,
  activeLayerId,
  onLayerSelect,
  onLayerAdd,
  onLayerDelete,
  onLayerRename,
  onLayerToggleVisibility,
  onLayerToggleLock,
  onLayerReorder,
  onLayerOpacityChange,
  onLayerDuplicate,
  onLayerBlendModeChange,
  layerThumbnails = {}
}: SketchLayerPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [showBlendMenu, setShowBlendMenu] = useState<string | null>(null);

  const BLEND_MODES: { value: BlendMode; label: string }[] = [
    { value: 'normal', label: 'Normal' },
    { value: 'multiply', label: 'Multiply' },
    { value: 'screen', label: 'Screen' },
    { value: 'overlay', label: 'Overlay' },
    { value: 'darken', label: 'Darken' },
    { value: 'lighten', label: 'Lighten' },
  ];

  const sortedLayers = [...layers].sort((a, b) => b.order - a.order);

  const startEditing = (layer: SketchLayer) => {
    setEditingLayerId(layer.id);
    setEditingName(layer.name);
  };

  const saveEditing = () => {
    if (editingLayerId && editingName.trim()) {
      onLayerRename(editingLayerId, editingName.trim());
    }
    setEditingLayerId(null);
    setEditingName('');
  };

  const cancelEditing = () => {
    setEditingLayerId(null);
    setEditingName('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveEditing();
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  };

  return (
    <>
      {/* Toggle Button */}
      <Button
        variant={isOpen ? 'default' : 'outline'}
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={() => setIsOpen(!isOpen)}
        title="Layers"
      >
        <Layers className="h-4 w-4" />
      </Button>

      {/* Layer Sidebar Panel */}
      {isOpen && (
        <div className="fixed right-0 top-0 bottom-0 w-28 bg-background border-l shadow-lg z-50 flex flex-col">
          {/* Add Layer Button */}
          <button
            onClick={onLayerAdd}
            className="h-14 flex items-center justify-center border-b hover:bg-muted/50 transition-colors"
          >
            <Plus className="h-6 w-6 text-muted-foreground" />
          </button>

          {/* Layer List */}
          <ScrollArea className="flex-1">
            <div className="flex flex-col">
              {sortedLayers.map((layer) => {
                const isActive = layer.id === activeLayerId;
                const isEditing = layer.id === editingLayerId;
                const thumbnail = layerThumbnails[layer.id];

                return (
                  <div
                    key={layer.id}
                    onClick={() => !layer.locked && onLayerSelect(layer.id)}
                    className={cn(
                      "relative cursor-pointer transition-all border-b group",
                      isActive 
                        ? "border-2 border-primary bg-primary/5" 
                        : "border-border/30 hover:bg-muted/30"
                    )}
                  >
                    {/* Layer Thumbnail */}
                    <div 
                      className={cn(
                        "w-full aspect-[4/3] bg-white relative",
                        !layer.visible && "opacity-40"
                      )}
                      style={{ opacity: layer.visible ? layer.opacity : 0.4 }}
                    >
                      {thumbnail ? (
                        <img 
                          src={thumbnail} 
                          alt={layer.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                          Empty
                        </div>
                      )}
                    </div>

                    {/* Visibility Toggle - Top Left */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onLayerToggleVisibility(layer.id);
                      }}
                      className="absolute top-1 left-1 p-0.5 rounded hover:bg-black/20 transition-colors"
                      title={layer.visible ? "Hide layer" : "Show layer"}
                    >
                      {layer.visible ? (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>

                    {/* Lock indicator if locked */}
                    {layer.locked && (
                      <div className="absolute top-1 right-1 p-0.5">
                        <Lock className="h-3 w-3 text-amber-500" />
                      </div>
                    )}

                    {/* Blend Mode indicator - Bottom Left */}
                    {isActive && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowBlendMenu(showBlendMenu === layer.id ? null : layer.id);
                        }}
                        className="absolute bottom-1 left-1 px-1 py-0.5 rounded bg-black/40 hover:bg-black/60 transition-colors text-white text-[8px] font-medium"
                        title="Blend mode"
                      >
                        {layer.blendMode === 'normal' ? 'N' : layer.blendMode.charAt(0).toUpperCase()}
                      </button>
                    )}

                    {/* Blend mode selector popup */}
                    {showBlendMenu === layer.id && (
                      <div 
                        className="absolute left-full top-0 ml-1 bg-background border rounded-lg shadow-lg p-1 z-50 min-w-[100px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {BLEND_MODES.map((mode) => (
                          <button
                            key={mode.value}
                            onClick={() => {
                              onLayerBlendModeChange(layer.id, mode.value);
                              setShowBlendMenu(null);
                            }}
                            className={cn(
                              "w-full text-left px-2 py-1 text-xs rounded hover:bg-muted transition-colors",
                              layer.blendMode === mode.value && "bg-primary/10 text-primary font-medium"
                            )}
                          >
                            {mode.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Hover Actions */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onLayerReorder(layer.id, 'up');
                        }}
                        className="p-1 bg-white/20 rounded hover:bg-white/40 transition-colors"
                        title="Move up"
                      >
                        <ChevronUp className="h-4 w-4 text-white" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onLayerReorder(layer.id, 'down');
                        }}
                        className="p-1 bg-white/20 rounded hover:bg-white/40 transition-colors"
                        title="Move down"
                      >
                        <ChevronDown className="h-4 w-4 text-white" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onLayerDuplicate(layer.id);
                        }}
                        className="p-1 bg-white/20 rounded hover:bg-white/40 transition-colors"
                        title="Duplicate"
                      >
                        <Copy className="h-4 w-4 text-white" />
                      </button>
                      {layers.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onLayerDelete(layer.id);
                          }}
                          className="p-1 bg-red-500/60 rounded hover:bg-red-500/80 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4 text-white" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {/* Color Wheel indicator at bottom */}
          <div className="h-14 flex items-center justify-center border-t">
            <div 
              className="w-8 h-8 rounded-full"
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
          </div>
        </div>
      )}
    </>
  );
};
