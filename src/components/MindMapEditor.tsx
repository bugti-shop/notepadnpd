import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Plus, Minus, ZoomIn, ZoomOut, Maximize2, Trash2,
  Edit2, Check, X, Palette, Link, Unlink, Download,
  Undo2, Redo2, Copy, Clipboard, CircleDot, Square,
  Triangle, Diamond, Hexagon, Star, Heart, LayoutGrid,
  FileText, Lightbulb, Target, BarChart3, GitBranch as BranchIcon,
  TreeDeciduous, Circle, Network, CheckCircle2, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';

export interface MindMapNode {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  shape: 'circle' | 'rectangle' | 'diamond' | 'hexagon' | 'star' | 'heart';
  fontSize: number;
  children: string[];
  parentId?: string;
  collapsed?: boolean;
}

export interface MindMapConnection {
  id: string;
  fromId: string;
  toId: string;
  color: string;
  style: 'solid' | 'dashed' | 'dotted';
}

export interface MindMapData {
  nodes: MindMapNode[];
  connections: MindMapConnection[];
  rootId: string;
  zoom: number;
  panX: number;
  panY: number;
}

interface MindMapEditorProps {
  content: string;
  onChange: (content: string) => void;
  title: string;
  onTitleChange: (title: string) => void;
}

const NODE_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#6366f1',
];

const createDefaultRootNode = (text: string): MindMapNode => ({
  id: 'root',
  text,
  x: 400,
  y: 300,
  color: '#3b82f6',
  shape: 'circle',
  fontSize: 18,
  children: [],
});

const DEFAULT_ROOT_NODE: MindMapNode = {
  id: 'root',
  text: 'Central Idea',
  x: 400,
  y: 300,
  color: '#3b82f6',
  shape: 'circle',
  fontSize: 18,
  children: [],
};

export const MindMapEditor = ({ content, onChange, title, onTitleChange }: MindMapEditorProps) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<MindMapData>(() => {
    try {
      if (content) {
        return JSON.parse(content);
      }
    } catch {}
    return {
      nodes: [createDefaultRootNode(t('mindMap.centralIdea'))],
      connections: [],
      rootId: 'root',
      zoom: 1,
      panX: 0,
      panY: 0,
    };
  });

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [history, setHistory] = useState<MindMapData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<MindMapNode | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  useEffect(() => {
    setIsSaving(true);
    onChange(JSON.stringify(data));
    const timer = setTimeout(() => {
      setIsSaving(false);
      setLastSaved(new Date());
    }, 300);
    return () => clearTimeout(timer);
  }, [data, onChange]);

  const saveHistory = useCallback((newData: MindMapData) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(newData)));
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setData(JSON.parse(JSON.stringify(history[historyIndex - 1])));
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setData(JSON.parse(JSON.stringify(history[historyIndex + 1])));
    }
  }, [history, historyIndex]);

  const updateData = useCallback((newData: MindMapData) => {
    setData(newData);
    saveHistory(newData);
  }, [saveHistory]);

  const addNode = useCallback((parentId?: string) => {
    const parent = parentId ? data.nodes.find(n => n.id === parentId) : data.nodes.find(n => n.id === data.rootId);
    if (!parent) return;

    const angle = (parent.children.length * 60) * (Math.PI / 180);
    const distance = 150;
    const newX = parent.x + Math.cos(angle) * distance;
    const newY = parent.y + Math.sin(angle) * distance;

    const newNode: MindMapNode = {
      id: `node-${Date.now()}`,
      text: t('mindMap.newIdea'),
      x: newX,
      y: newY,
      color: NODE_COLORS[data.nodes.length % NODE_COLORS.length],
      shape: 'rectangle',
      fontSize: 14,
      children: [],
      parentId: parent.id,
    };

    const newConnection: MindMapConnection = {
      id: `conn-${Date.now()}`,
      fromId: parent.id,
      toId: newNode.id,
      color: newNode.color,
      style: 'solid',
    };

    const updatedParent = { ...parent, children: [...parent.children, newNode.id] };
    const newNodes = data.nodes.map(n => n.id === parent.id ? updatedParent : n);

    updateData({
      ...data,
      nodes: [...newNodes, newNode],
      connections: [...data.connections, newConnection],
    });

    setSelectedNodeId(newNode.id);
    setEditingNodeId(newNode.id);
    setEditText(newNode.text);
  }, [data, updateData]);

  const deleteNode = useCallback((nodeId: string) => {
    if (nodeId === data.rootId) {
      toast.error(t('mindMap.cannotDeleteRoot'));
      return;
    }

    const getDescendants = (id: string): string[] => {
      const node = data.nodes.find(n => n.id === id);
      if (!node) return [];
      return [id, ...node.children.flatMap(getDescendants)];
    };

    const nodesToDelete = new Set(getDescendants(nodeId));

    const updatedNodes = data.nodes
      .filter(n => !nodesToDelete.has(n.id))
      .map(n => ({
        ...n,
        children: n.children.filter(c => !nodesToDelete.has(c)),
      }));

    const updatedConnections = data.connections.filter(
      c => !nodesToDelete.has(c.fromId) && !nodesToDelete.has(c.toId)
    );

    updateData({
      ...data,
      nodes: updatedNodes,
      connections: updatedConnections,
    });

    setSelectedNodeId(null);
  }, [data, updateData]);

  const updateNodeText = useCallback((nodeId: string, text: string) => {
    updateData({
      ...data,
      nodes: data.nodes.map(n => n.id === nodeId ? { ...n, text } : n),
    });
    setEditingNodeId(null);
  }, [data, updateData]);

  const updateNodeColor = useCallback((nodeId: string, color: string) => {
    const updatedNodes = data.nodes.map(n => n.id === nodeId ? { ...n, color } : n);
    const updatedConnections = data.connections.map(c =>
      c.fromId === nodeId || c.toId === nodeId ? { ...c, color } : c
    );
    updateData({ ...data, nodes: updatedNodes, connections: updatedConnections });
  }, [data, updateData]);

  const updateNodeShape = useCallback((nodeId: string, shape: MindMapNode['shape']) => {
    updateData({
      ...data,
      nodes: data.nodes.map(n => n.id === nodeId ? { ...n, shape } : n),
    });
  }, [data, updateData]);

  const handleNodeDrag = useCallback((nodeId: string, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    setSelectedNodeId(nodeId);

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const node = data.nodes.find(n => n.id === nodeId);
    if (node) {
      setDragStart({ x: clientX - node.x * data.zoom, y: clientY - node.y * data.zoom });
    }
  }, [data]);

  const handleMouseMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    if (isDragging && selectedNodeId) {
      const newX = (clientX - dragStart.x) / data.zoom;
      const newY = (clientY - dragStart.y) / data.zoom;

      setData(prev => ({
        ...prev,
        nodes: prev.nodes.map(n =>
          n.id === selectedNodeId ? { ...n, x: newX, y: newY } : n
        ),
      }));
    } else if (isPanning) {
      const dx = clientX - panStart.x;
      const dy = clientY - panStart.y;
      setData(prev => ({
        ...prev,
        panX: prev.panX + dx,
        panY: prev.panY + dy,
      }));
      setPanStart({ x: clientX, y: clientY });
    }
  }, [isDragging, selectedNodeId, dragStart, data.zoom, isPanning, panStart]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      saveHistory(data);
    }
    setIsDragging(false);
    setIsPanning(false);
  }, [isDragging, data, saveHistory]);

  const handleCanvasPan = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (e.target === canvasRef.current) {
      setIsPanning(true);
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      setPanStart({ x: clientX, y: clientY });
    }
  }, []);

  const zoomIn = () => setData(prev => ({ ...prev, zoom: Math.min(prev.zoom + 0.1, 3) }));
  const zoomOut = () => setData(prev => ({ ...prev, zoom: Math.max(prev.zoom - 0.1, 0.3) }));
  const resetView = () => setData(prev => ({ ...prev, zoom: 1, panX: 0, panY: 0 }));

  const copyNode = useCallback(() => {
    const node = data.nodes.find(n => n.id === selectedNodeId);
    if (node) {
      setClipboard({ ...node });
      toast.success(t('mindMap.nodeCopied'));
    }
  }, [data.nodes, selectedNodeId, t]);

  const pasteNode = useCallback(() => {
    if (!clipboard || !selectedNodeId) return;

    const parent = data.nodes.find(n => n.id === selectedNodeId);
    if (!parent) return;

    const newNode: MindMapNode = {
      ...clipboard,
      id: `node-${Date.now()}`,
      x: parent.x + 100,
      y: parent.y + 100,
      parentId: parent.id,
      children: [],
    };

    const newConnection: MindMapConnection = {
      id: `conn-${Date.now()}`,
      fromId: parent.id,
      toId: newNode.id,
      color: newNode.color,
      style: 'solid',
    };

    const updatedParent = { ...parent, children: [...parent.children, newNode.id] };

    updateData({
      ...data,
      nodes: [...data.nodes.map(n => n.id === parent.id ? updatedParent : n), newNode],
      connections: [...data.connections, newConnection],
    });

    toast.success(t('mindMap.nodePasted'));
  }, [clipboard, selectedNodeId, data, updateData, t]);

  const toggleCollapse = useCallback((nodeId: string) => {
    updateData({
      ...data,
      nodes: data.nodes.map(n =>
        n.id === nodeId ? { ...n, collapsed: !n.collapsed } : n
      ),
    });
  }, [data, updateData]);

  const renderConnection = (conn: MindMapConnection) => {
    const from = data.nodes.find(n => n.id === conn.fromId);
    const to = data.nodes.find(n => n.id === conn.toId);
    if (!from || !to) return null;

    if (from.collapsed) return null;

    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2 - 30;

    return (
      <g key={conn.id}>
        <path
          d={`M ${from.x} ${from.y} Q ${midX} ${midY} ${to.x} ${to.y}`}
          fill="none"
          stroke={conn.color}
          strokeWidth={2}
          strokeDasharray={conn.style === 'dashed' ? '8,4' : conn.style === 'dotted' ? '2,2' : undefined}
          className="transition-all duration-200"
        />
      </g>
    );
  };

  const renderNode = (node: MindMapNode) => {
    const isSelected = selectedNodeId === node.id;
    const isEditing = editingNodeId === node.id;
    const isRoot = node.id === data.rootId;

    if (node.parentId) {
      const parent = data.nodes.find(n => n.id === node.parentId);
      if (parent?.collapsed) return null;
    }

    const getShapePath = () => {
      const size = isRoot ? 60 : 45;
      switch (node.shape) {
        case 'circle':
          return <circle cx={0} cy={0} r={size} />;
        case 'rectangle':
          return <rect x={-size * 1.5} y={-size * 0.6} width={size * 3} height={size * 1.2} rx={8} />;
        case 'diamond':
          return <polygon points={`0,${-size} ${size},0 0,${size} ${-size},0`} />;
        case 'hexagon':
          const h = size * 0.866;
          return <polygon points={`${-size},0 ${-size/2},${-h} ${size/2},${-h} ${size},0 ${size/2},${h} ${-size/2},${h}`} />;
        case 'star':
          const points = [];
          for (let i = 0; i < 10; i++) {
            const r = i % 2 === 0 ? size : size / 2;
            const angle = (i * 36 - 90) * Math.PI / 180;
            points.push(`${r * Math.cos(angle)},${r * Math.sin(angle)}`);
          }
          return <polygon points={points.join(' ')} />;
        case 'heart':
          return <path d={`M 0 ${size * 0.3} C ${-size} ${-size * 0.5} ${-size} ${size * 0.5} 0 ${size} C ${size} ${size * 0.5} ${size} ${-size * 0.5} 0 ${size * 0.3}`} />;
        default:
          return <circle cx={0} cy={0} r={size} />;
      }
    };

    const getContrastColor = (hexColor: string) => {
      const r = parseInt(hexColor.slice(1, 3), 16);
      const g = parseInt(hexColor.slice(3, 5), 16);
      const b = parseInt(hexColor.slice(5, 7), 16);
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      return brightness > 128 ? '#000' : '#fff';
    };

    return (
      <g
        key={node.id}
        transform={`translate(${node.x}, ${node.y})`}
        className={cn('cursor-pointer transition-transform', isDragging && selectedNodeId === node.id && 'opacity-80')}
        onMouseDown={(e) => handleNodeDrag(node.id, e)}
        onTouchStart={(e) => handleNodeDrag(node.id, e)}
        onClick={(e) => {
          e.stopPropagation();
          if (connectingFrom && connectingFrom !== node.id) {
            const newConnection: MindMapConnection = {
              id: `conn-${Date.now()}`,
              fromId: connectingFrom,
              toId: node.id,
              color: '#666',
              style: 'dashed',
            };
            updateData({
              ...data,
              connections: [...data.connections, newConnection],
            });
            setConnectingFrom(null);
            toast.success(t('mindMap.connectionCreated'));
          } else {
            setSelectedNodeId(node.id);
          }
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          setEditingNodeId(node.id);
          setEditText(node.text);
        }}
      >
        <g fill={node.color} stroke={isSelected ? '#000' : 'transparent'} strokeWidth={3}>
          {getShapePath()}
        </g>

        {isEditing ? (
          <foreignObject x={-80} y={-15} width={160} height={30}>
            <Input
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onBlur={() => updateNodeText(node.id, editText)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  updateNodeText(node.id, editText);
                } else if (e.key === 'Escape') {
                  setEditingNodeId(null);
                }
              }}
              className="text-center h-7 text-sm bg-white"
              autoFocus
            />
          </foreignObject>
        ) : (
          <text
            textAnchor="middle"
            dominantBaseline="middle"
            fill={getContrastColor(node.color)}
            fontSize={node.fontSize}
            fontWeight={isRoot ? 'bold' : 'normal'}
            className="pointer-events-none select-none"
          >
            {node.text.length > 20 ? node.text.slice(0, 20) + '...' : node.text}
          </text>
        )}

        {node.children.length > 0 && (
          <g
            className="cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              toggleCollapse(node.id);
            }}
          >
            <circle cx={isRoot ? 60 : 50} cy={0} r={12} fill="#fff" stroke="#ddd" />
            <text x={isRoot ? 60 : 50} y={1} textAnchor="middle" dominantBaseline="middle" fontSize={14}>
              {node.collapsed ? '+' : '-'}
            </text>
          </g>
        )}
      </g>
    );
  };

  const selectedNode = data.nodes.find(n => n.id === selectedNodeId);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Title */}
      <div className="px-4 py-3 border-b flex items-center gap-2">
        {/* Save Status Indicator */}
        <div className="flex items-center gap-1">
          {isSaving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          ) : lastSaved ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          ) : null}
        </div>
        <Input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Mind Map Title"
          className="text-xl font-bold border-0 px-0 focus-visible:ring-0 flex-1"
        />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-2 border-b bg-muted/30 flex-wrap">
        <Button size="sm" variant="ghost" onClick={zoomOut} title="Zoom Out"><ZoomOut className="h-4 w-4" /></Button>
        <span className="text-xs w-12 text-center">{Math.round(data.zoom * 100)}%</span>
        <Button size="sm" variant="ghost" onClick={zoomIn} title="Zoom In"><ZoomIn className="h-4 w-4" /></Button>
        <Button size="sm" variant="ghost" onClick={resetView} title="Reset View"><Maximize2 className="h-4 w-4" /></Button>

        <div className="w-px h-6 bg-border mx-1" />

        <Button size="sm" variant="ghost" onClick={undo} disabled={historyIndex <= 0} title="Undo"><Undo2 className="h-4 w-4" /></Button>
        <Button size="sm" variant="ghost" onClick={redo} disabled={historyIndex >= history.length - 1} title="Redo"><Redo2 className="h-4 w-4" /></Button>

        <div className="w-px h-6 bg-border mx-1" />

        <Button size="sm" variant="ghost" onClick={() => addNode(selectedNodeId || data.rootId)} title="Add Node"><Plus className="h-4 w-4" /></Button>
        {selectedNodeId && selectedNodeId !== data.rootId && (
          <Button size="sm" variant="ghost" onClick={() => deleteNode(selectedNodeId)} title="Delete"><Trash2 className="h-4 w-4" /></Button>
        )}

        <div className="w-px h-6 bg-border mx-1" />

        <Button size="sm" variant="ghost" onClick={copyNode} disabled={!selectedNodeId} title="Copy"><Copy className="h-4 w-4" /></Button>
        <Button size="sm" variant="ghost" onClick={pasteNode} disabled={!clipboard || !selectedNodeId} title="Paste"><Clipboard className="h-4 w-4" /></Button>

        <div className="w-px h-6 bg-border mx-1" />

        <Button
          size="sm"
          variant={connectingFrom ? "default" : "ghost"}
          onClick={() => setConnectingFrom(connectingFrom ? null : selectedNodeId)}
          disabled={!selectedNodeId}
          title="Create Connection"
        >
          {connectingFrom ? <Unlink className="h-4 w-4" /> : <Link className="h-4 w-4" />}
        </Button>

        {selectedNode && (
          <>
            <div className="w-px h-6 bg-border mx-1" />

            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" variant="ghost" title="Node Color">
                  <div className="h-4 w-4 rounded-full border" style={{ backgroundColor: selectedNode.color }} />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2">
                <div className="grid grid-cols-5 gap-1">
                  {NODE_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => updateNodeColor(selectedNodeId!, color)}
                      className={cn(
                        "h-6 w-6 rounded-full border-2 transition-transform hover:scale-110",
                        selectedNode.color === color ? "border-foreground" : "border-transparent"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" title="Node Shape">
                  {selectedNode.shape === 'circle' && <CircleDot className="h-4 w-4" />}
                  {selectedNode.shape === 'rectangle' && <Square className="h-4 w-4" />}
                  {selectedNode.shape === 'diamond' && <Diamond className="h-4 w-4" />}
                  {selectedNode.shape === 'hexagon' && <Hexagon className="h-4 w-4" />}
                  {selectedNode.shape === 'star' && <Star className="h-4 w-4" />}
                  {selectedNode.shape === 'heart' && <Heart className="h-4 w-4" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Shape</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => updateNodeShape(selectedNodeId!, 'circle')}><CircleDot className="h-4 w-4 mr-2" /> Circle</DropdownMenuItem>
                <DropdownMenuItem onClick={() => updateNodeShape(selectedNodeId!, 'rectangle')}><Square className="h-4 w-4 mr-2" /> Rectangle</DropdownMenuItem>
                <DropdownMenuItem onClick={() => updateNodeShape(selectedNodeId!, 'diamond')}><Diamond className="h-4 w-4 mr-2" /> Diamond</DropdownMenuItem>
                <DropdownMenuItem onClick={() => updateNodeShape(selectedNodeId!, 'hexagon')}><Hexagon className="h-4 w-4 mr-2" /> Hexagon</DropdownMenuItem>
                <DropdownMenuItem onClick={() => updateNodeShape(selectedNodeId!, 'star')}><Star className="h-4 w-4 mr-2" /> Star</DropdownMenuItem>
                <DropdownMenuItem onClick={() => updateNodeShape(selectedNodeId!, 'heart')}><Heart className="h-4 w-4 mr-2" /> Heart</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="flex-1 overflow-hidden bg-[#fafafa] dark:bg-zinc-900 cursor-grab active:cursor-grabbing"
        onMouseDown={handleCanvasPan}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleCanvasPan}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
        onClick={() => {
          setSelectedNodeId(null);
          setConnectingFrom(null);
        }}
      >
        <svg
          width="100%"
          height="100%"
          style={{
            transform: `translate(${data.panX}px, ${data.panY}px) scale(${data.zoom})`,
            transformOrigin: 'center center',
          }}
        >
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e5e5e5" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="2000" height="2000" x="-500" y="-200" fill="url(#grid)" />

          {data.connections.map(renderConnection)}
          {data.nodes.map(renderNode)}
        </svg>
      </div>

      {/* Status bar */}
      <div className="px-3 py-1.5 border-t bg-muted/30 text-xs text-muted-foreground flex justify-between">
        <span>{data.nodes.length} nodes • {data.connections.length} connections</span>
        <span>
          {selectedNodeId ? `Selected: ${selectedNode?.text || 'Unknown'}` : 'Click to select, double-click to edit'}
        </span>
      </div>
    </div>
  );
};
