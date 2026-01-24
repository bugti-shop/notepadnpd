import { useState, useRef, useCallback, useEffect, useMemo, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { TodoItem, TaskSection } from '@/types/note';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface UnifiedDragDropListProps {
  sections: TaskSection[];
  items: TodoItem[];
  onReorder: (updatedItems: TodoItem[]) => void;
  onSectionReorder: (updatedSections: TaskSection[]) => void;
  onTaskClick: (task: TodoItem, parentId?: string) => void;
  renderTask: (item: TodoItem, isDragging: boolean, isDropTarget: boolean, parentId?: string) => React.ReactNode;
  renderSubtask: (subtask: TodoItem, parentId: string, isDragging: boolean, isDropTarget: boolean) => React.ReactNode;
  renderSectionHeader: (section: TaskSection, isDragging: boolean) => React.ReactNode;
  renderEmptySection: (section: TaskSection) => React.ReactNode;
  expandedTasks: Set<string>;
  selectedFolderId?: string | null;
  className?: string;
}

const LONG_PRESS_DELAY = 150; // Reduced for faster response

// Increased limits for better initial experience
const INITIAL_VISIBLE_ITEMS = 50;
const LOAD_MORE_INCREMENT = 50;
const VIRTUALIZATION_THRESHOLD = 100; // Use virtualization above this count

interface DragItem {
  id: string;
  type: 'task' | 'subtask';
  parentId?: string;
  sectionId?: string;
}

interface DropTarget {
  type: 'section' | 'task' | 'subtask-area';
  sectionId?: string;
  taskId?: string;
  position?: 'before' | 'after';
  insertIndex?: number;
  indicatorY?: number; // Track indicator position
}

// Infinite scroll trigger component using IntersectionObserver
const InfiniteScrollTrigger = memo(({ 
  onVisible, 
  hiddenCount, 
  loadMoreIncrement 
}: { 
  onVisible: () => void; 
  hiddenCount: number; 
  loadMoreIncrement: number;
}) => {
  const triggerRef = useRef<HTMLDivElement>(null);
  const hasTriggeredRef = useRef(false);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !hasTriggeredRef.current) {
          hasTriggeredRef.current = true;
          onVisible();
          // Reset after a short delay to allow multiple loads
          setTimeout(() => {
            hasTriggeredRef.current = false;
          }, 500);
        }
      },
      { 
        threshold: 0.1,
        rootMargin: '100px' // Trigger 100px before element is visible
      }
    );
    
    if (triggerRef.current) {
      observer.observe(triggerRef.current);
    }
    
    return () => observer.disconnect();
  }, [onVisible]);
  
  return (
    <div 
      ref={triggerRef}
      className="py-3 px-4 flex items-center justify-center bg-muted/20"
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <div className="w-4 h-4 border-2 border-muted-foreground/30 border-t-primary rounded-full animate-spin" />
        <span>Loading {Math.min(hiddenCount, loadMoreIncrement)} more ({hiddenCount} remaining)</span>
      </div>
    </div>
  );
});

// Memoized task row component for virtualization
const MemoizedTaskRow = memo(({
  item,
  isDragging,
  isSubtaskDropTarget,
  hasSubtasks,
  isExpanded,
  subtasks,
  draggedItemId,
  draggedItemType,
  setItemRef,
  handleTouchStart,
  renderTask,
  renderSubtask,
}: {
  item: TodoItem;
  isDragging: boolean;
  isSubtaskDropTarget: boolean;
  hasSubtasks: boolean;
  isExpanded: boolean;
  subtasks: TodoItem[];
  draggedItemId: string | null;
  draggedItemType: string | null;
  setItemRef: (id: string, ref: HTMLDivElement | null) => void;
  handleTouchStart: (dragItem: DragItem, e: React.TouchEvent) => void;
  renderTask: (item: TodoItem, isDragging: boolean, isDropTarget: boolean, parentId?: string) => React.ReactNode;
  renderSubtask: (subtask: TodoItem, parentId: string, isDragging: boolean, isDropTarget: boolean) => React.ReactNode;
}) => {
  return (
    <div>
      <div
        ref={(ref) => setItemRef(item.id, ref)}
        className={cn(
          "relative will-change-transform",
          isDragging && "z-50 opacity-95 scale-[1.02] shadow-2xl bg-card rounded-lg"
        )}
        onTouchStart={(e) => handleTouchStart({ id: item.id, type: 'task', sectionId: item.sectionId }, e)}
      >
        {renderTask(item, isDragging, isSubtaskDropTarget, undefined)}

        {isSubtaskDropTarget && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30 ring-2 ring-primary ring-inset bg-primary/10 rounded-lg">
            <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full shadow-sm">
              Make subtask
            </span>
          </div>
        )}
      </div>

      {hasSubtasks && isExpanded && (
        <div className="ml-8 border-l-2 border-muted/50 bg-muted/10">
          {subtasks.slice(0, 20).map((subtask) => {
            const isSubtaskDragging = draggedItemId === subtask.id && draggedItemType === 'subtask';
            
            return (
              <div
                key={subtask.id}
                ref={(ref) => setItemRef(subtask.id, ref)}
                className={cn(
                  "relative will-change-transform",
                  isSubtaskDragging && "z-50 opacity-95 scale-[1.02] shadow-2xl bg-card rounded-lg"
                )}
                onTouchStart={(e) => handleTouchStart({ id: subtask.id, type: 'subtask', parentId: item.id }, e)}
              >
                {renderSubtask(subtask, item.id, isSubtaskDragging, false)}
              </div>
            );
          })}
          {subtasks.length > 20 && (
            <div className="py-2 px-4 text-xs text-muted-foreground text-center">
              +{subtasks.length - 20} more subtasks (tap task to view all)
            </div>
          )}
        </div>
      )}
    </div>
  );
});

MemoizedTaskRow.displayName = 'MemoizedTaskRow';

// Virtualized section content for large task lists
const VirtualizedSectionContent = memo(({
  tasks,
  expandedTasks,
  draggedItemId,
  draggedItemType,
  dropTargetTaskId,
  setItemRef,
  handleTouchStart,
  renderTask,
  renderSubtask,
}: {
  tasks: TodoItem[];
  expandedTasks: Set<string>;
  draggedItemId: string | null;
  draggedItemType: string | null;
  dropTargetTaskId: string | null;
  setItemRef: (id: string, ref: HTMLDivElement | null) => void;
  handleTouchStart: (dragItem: DragItem, e: React.TouchEvent) => void;
  renderTask: (item: TodoItem, isDragging: boolean, isDropTarget: boolean, parentId?: string) => React.ReactNode;
  renderSubtask: (subtask: TodoItem, parentId: string, isDragging: boolean, isDropTarget: boolean) => React.ReactNode;
}) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: tasks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 15, // Extra items for smooth scrolling
    getItemKey: (index) => tasks[index]?.id || index.toString(),
  });

  return (
    <div 
      ref={parentRef} 
      className="max-h-[500px] overflow-auto"
      style={{ contain: 'strict' }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const item = tasks[virtualRow.index];
          if (!item) return null;

          const isDragging = draggedItemId === item.id && draggedItemType === 'task';
          const isSubtaskDropTarget = dropTargetTaskId === item.id;
          const hasSubtasks = item.subtasks && item.subtasks.length > 0;
          const isExpanded = expandedTasks.has(item.id);

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <MemoizedTaskRow
                item={item}
                isDragging={isDragging}
                isSubtaskDropTarget={isSubtaskDropTarget}
                hasSubtasks={hasSubtasks}
                isExpanded={isExpanded}
                subtasks={item.subtasks || []}
                draggedItemId={draggedItemId}
                draggedItemType={draggedItemType}
                setItemRef={setItemRef}
                handleTouchStart={handleTouchStart}
                renderTask={renderTask}
                renderSubtask={renderSubtask}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});

VirtualizedSectionContent.displayName = 'VirtualizedSectionContent';

export const UnifiedDragDropList = ({
  sections,
  items,
  onReorder,
  onSectionReorder,
  onTaskClick,
  renderTask,
  renderSubtask,
  renderSectionHeader,
  renderEmptySection,
  expandedTasks,
  selectedFolderId,
  className
}: UnifiedDragDropListProps) => {
  // Use refs for frequently updated values to avoid re-renders
  const dragStateRef = useRef({
    isDragging: false,
    draggedItem: null as DragItem | null,
    translateY: 0,
    startY: 0,
    currentY: 0,
    dropTarget: null as DropTarget | null,
    draggedElementTop: 0,
  });
  
  const [renderTrigger, setRenderTrigger] = useState(0);
  // Track expanded sections for loading more items
  const [expandedSectionLimits, setExpandedSectionLimits] = useState<Record<string, number>>({});
  const animationFrameRef = useRef<number | null>(null);
  const lastHapticRef = useRef<string | null>(null);

  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);

  // Memoize sorted sections - filter to only show sections with tasks when a folder is selected
  const sortedSections = useMemo(() => {
    const sorted = [...sections].sort((a, b) => a.order - b.order);
    
    // When a folder is selected, only show sections that have tasks in that folder
    if (selectedFolderId) {
      return sorted.filter(section => {
        const sectionTasks = items.filter(item => 
          !item.completed && (item.sectionId === section.id || (!item.sectionId && section.id === sections[0]?.id))
        );
        return sectionTasks.length > 0;
      });
    }
    
    return sorted;
  }, [sections, selectedFolderId, items]);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // Find scrollable parent
  useEffect(() => {
    if (containerRef.current) {
      let parent = containerRef.current.parentElement;
      while (parent) {
        const style = getComputedStyle(parent);
        if (style.overflow === 'auto' || style.overflow === 'scroll' || 
            style.overflowY === 'auto' || style.overflowY === 'scroll') {
          scrollContainerRef.current = parent;
          break;
        }
        parent = parent.parentElement;
      }
    }
  }, []);

  // Disable scrolling during drag
  useEffect(() => {
    if (dragStateRef.current.isDragging) {
      const scrollContainer = scrollContainerRef.current;
      const originalBodyOverflow = document.body.style.overflow;
      const originalHtmlOverflow = document.documentElement.style.overflow;
      const originalScrollContainerOverflow = scrollContainer?.style.overflow;
      
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      if (scrollContainer) {
        scrollContainer.style.overflow = 'hidden';
      }
      
      return () => {
        document.body.style.overflow = originalBodyOverflow;
        document.documentElement.style.overflow = originalHtmlOverflow;
        if (scrollContainer) {
          scrollContainer.style.overflow = originalScrollContainerOverflow || '';
        }
      };
    }
  }, [renderTrigger]);

  const handleTouchStart = useCallback((item: DragItem, e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    hasMovedRef.current = false;

    const element = itemRefs.current.get(item.id);
    const elementTop = element?.getBoundingClientRect().top || touch.clientY;

    longPressTimerRef.current = setTimeout(async () => {
      if (!hasMovedRef.current) {
        try {
          await Haptics.impact({ style: ImpactStyle.Medium });
        } catch {}

        dragStateRef.current = {
          isDragging: true,
          draggedItem: item,
          translateY: 0,
          startY: touch.clientY,
          currentY: touch.clientY,
          dropTarget: null,
          draggedElementTop: elementTop,
        };
        setRenderTrigger(prev => prev + 1);
      }
    }, LONG_PRESS_DELAY);
  }, []);

  const findDropTarget = useCallback((draggedElementCurrentTop: number): DropTarget | null => {
    const draggedItem = dragStateRef.current.draggedItem;
    if (!draggedItem) return null;

    let closestTarget: DropTarget | null = null;
    let closestDistance = Infinity;

    // Build task positions list, sorted by visual order (top to bottom)
    const taskPositions: { id: string; rect: DOMRect; sectionId?: string; originalIndex: number }[] = [];
    
    // Get all non-completed tasks that aren't being dragged
    const orderedTasks = items.filter(i => !i.completed && i.id !== draggedItem.id);
    
    orderedTasks.forEach((item, index) => {
      const ref = itemRefs.current.get(item.id);
      if (ref) {
        taskPositions.push({ 
          id: item.id, 
          rect: ref.getBoundingClientRect(), 
          sectionId: item.sectionId,
          originalIndex: index
        });
      }
    });

    // Sort by visual position (top of element)
    taskPositions.sort((a, b) => a.rect.top - b.rect.top);

    for (let visualIndex = 0; visualIndex < taskPositions.length; visualIndex++) {
      const { id, rect, sectionId } = taskPositions[visualIndex];
      const taskCenterY = rect.top + rect.height / 2;
      
      const subtaskZoneStart = rect.top + rect.height * 0.3;
      const subtaskZoneEnd = rect.top + rect.height * 0.7;
      
      if (draggedElementCurrentTop >= subtaskZoneStart && draggedElementCurrentTop <= subtaskZoneEnd && draggedItem.type === 'task') {
        const distance = Math.abs(draggedElementCurrentTop - taskCenterY);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestTarget = { type: 'subtask-area', taskId: id, sectionId, indicatorY: taskCenterY };
        }
      } else {
        // Check if we should place before or after this task
        if (draggedElementCurrentTop < taskCenterY) {
          const distance = Math.abs(draggedElementCurrentTop - rect.top);
          if (distance < closestDistance) {
            closestDistance = distance;
            closestTarget = { type: 'task', taskId: id, position: 'before', sectionId, indicatorY: rect.top };
          }
        } else {
          const distance = Math.abs(draggedElementCurrentTop - rect.bottom);
          if (distance < closestDistance) {
            closestDistance = distance;
            closestTarget = { type: 'task', taskId: id, position: 'after', sectionId, indicatorY: rect.bottom };
          }
        }
      }
    }

    if (!closestTarget || closestDistance > 60) {
      sectionRefs.current.forEach((ref, sectionId) => {
        const rect = ref.getBoundingClientRect();
        if (draggedElementCurrentTop >= rect.top && draggedElementCurrentTop <= rect.bottom) {
          closestTarget = { type: 'section', sectionId, indicatorY: rect.top + rect.height / 2 };
        }
      });
    }

    return closestTarget;
  }, [items]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);

    if (!dragStateRef.current.isDragging && (deltaX > 8 || deltaY > 8)) {
      hasMovedRef.current = true;
      clearLongPressTimer();
      return;
    }

    if (dragStateRef.current.isDragging) {
      e.preventDefault();
      e.stopPropagation();
      
      // Cancel any pending animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      // Use requestAnimationFrame for smooth updates
      animationFrameRef.current = requestAnimationFrame(() => {
        const translateY = touch.clientY - dragStateRef.current.startY;
        const draggedElementCurrentTop = dragStateRef.current.draggedElementTop + translateY;
        const newDropTarget = findDropTarget(draggedElementCurrentTop);
        
        // Update ref immediately for instant visual feedback
        dragStateRef.current.translateY = translateY;
        dragStateRef.current.currentY = touch.clientY;
        
        // Directly update dragged element transform for instant response
        const draggedItem = dragStateRef.current.draggedItem;
        if (draggedItem) {
          const element = itemRefs.current.get(draggedItem.id);
          if (element) {
            element.style.transform = `translateY(${translateY}px)`;
          }
        }
        
        // Update indicator position directly
        if (indicatorRef.current && newDropTarget?.indicatorY !== undefined) {
          const containerRect = containerRef.current?.getBoundingClientRect();
          if (containerRect) {
            indicatorRef.current.style.top = `${newDropTarget.indicatorY - containerRect.top}px`;
            indicatorRef.current.style.opacity = newDropTarget.type === 'subtask-area' ? '0' : '1';
          }
        } else if (indicatorRef.current) {
          indicatorRef.current.style.opacity = '0';
        }
        
        // Haptic feedback on target change (debounced)
        const targetKey = newDropTarget ? `${newDropTarget.type}-${newDropTarget.taskId}-${newDropTarget.position}` : null;
        if (targetKey !== lastHapticRef.current) {
          lastHapticRef.current = targetKey;
          if (newDropTarget) {
            try { Haptics.impact({ style: ImpactStyle.Light }); } catch {}
          }
        }
        
        dragStateRef.current.dropTarget = newDropTarget;
        
        // Only trigger re-render for drop target changes (for highlighting)
        setRenderTrigger(prev => prev + 1);
      });
    }
  }, [findDropTarget, clearLongPressTimer]);

  const handleTouchEnd = useCallback(() => {
    clearLongPressTimer();
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const { isDragging, draggedItem, dropTarget } = dragStateRef.current;

    if (isDragging && draggedItem && dropTarget) {
      try {
        Haptics.impact({ style: ImpactStyle.Heavy });
      } catch {}

      let newItems = [...items];

      if (draggedItem.type === 'task') {
        const taskIndex = newItems.findIndex(i => i.id === draggedItem.id);
        if (taskIndex === -1) {
          resetDragState();
          return;
        }
        
        const movedTask = { ...newItems[taskIndex] };
        
        // Remove the task from its current position
        newItems = newItems.filter(i => i.id !== draggedItem.id);

        if (dropTarget.type === 'subtask-area' && dropTarget.taskId) {
          // Convert to subtask
          newItems = newItems.map(item => {
            if (item.id === dropTarget.taskId) {
              return {
                ...item,
                subtasks: [...(item.subtasks || []), { ...movedTask, sectionId: undefined }]
              };
            }
            return item;
          });
        } else if (dropTarget.type === 'task' && dropTarget.taskId) {
          // Find the target task's current index in the filtered array
          const targetIndex = newItems.findIndex(i => i.id === dropTarget.taskId);
          
          if (targetIndex !== -1) {
            // Update section ID to match target
            const targetTask = newItems[targetIndex];
            movedTask.sectionId = targetTask?.sectionId;
            
            // Insert at the correct position
            const insertIndex = dropTarget.position === 'after' ? targetIndex + 1 : targetIndex;
            newItems.splice(insertIndex, 0, movedTask);
          } else {
            // Fallback: add to end
            newItems.push(movedTask);
          }
        } else if (dropTarget.type === 'section' && dropTarget.sectionId) {
          // Move to section (add at end of section)
          movedTask.sectionId = dropTarget.sectionId;
          
          // Find the last task in this section to insert after it
          let lastSectionTaskIndex = -1;
          for (let i = newItems.length - 1; i >= 0; i--) {
            if (newItems[i].sectionId === dropTarget.sectionId && !newItems[i].completed) {
              lastSectionTaskIndex = i;
              break;
            }
          }
          
          if (lastSectionTaskIndex !== -1) {
            newItems.splice(lastSectionTaskIndex + 1, 0, movedTask);
          } else {
            // No tasks in section, find where section tasks should be
            newItems.push(movedTask);
          }
        }
      } else if (draggedItem.type === 'subtask' && draggedItem.parentId) {
        let movedSubtask: TodoItem | null = null;
        newItems = newItems.map(item => {
          if (item.id === draggedItem.parentId && item.subtasks) {
            const subtaskIndex = item.subtasks.findIndex(st => st.id === draggedItem.id);
            if (subtaskIndex !== -1) {
              movedSubtask = item.subtasks[subtaskIndex];
              return {
                ...item,
                subtasks: item.subtasks.filter(st => st.id !== draggedItem.id)
              };
            }
          }
          return item;
        });

        if (movedSubtask) {
          if (dropTarget.type === 'section' || (dropTarget.type === 'task' && dropTarget.taskId !== draggedItem.parentId)) {
            const newTask: TodoItem = {
              ...movedSubtask,
              sectionId: dropTarget.sectionId || sections[0]?.id,
            };
            
            if (dropTarget.type === 'task' && dropTarget.taskId) {
              const targetIndex = newItems.findIndex(i => i.id === dropTarget.taskId);
              const insertIndex = dropTarget.position === 'after' ? targetIndex + 1 : targetIndex;
              const targetTask = newItems[targetIndex];
              newTask.sectionId = targetTask?.sectionId;
              newItems.splice(insertIndex, 0, newTask);
            } else {
              newItems.push(newTask);
            }
          } else if (dropTarget.type === 'subtask-area' && dropTarget.taskId && dropTarget.taskId !== draggedItem.parentId) {
            newItems = newItems.map(item => {
              if (item.id === dropTarget.taskId) {
                return {
                  ...item,
                  subtasks: [...(item.subtasks || []), movedSubtask!]
                };
              }
              return item;
            });
          }
        }
      }

      onReorder(newItems);
    }

    resetDragState();
  }, [items, sections, onReorder, clearLongPressTimer]);

  const resetDragState = useCallback(() => {
    // Reset element transform
    const draggedItem = dragStateRef.current.draggedItem;
    if (draggedItem) {
      const element = itemRefs.current.get(draggedItem.id);
      if (element) {
        element.style.transform = '';
      }
    }
    
    // Hide indicator
    if (indicatorRef.current) {
      indicatorRef.current.style.opacity = '0';
    }
    
    dragStateRef.current = {
      isDragging: false,
      draggedItem: null,
      translateY: 0,
      startY: 0,
      currentY: 0,
      dropTarget: null,
      draggedElementTop: 0,
    };
    lastHapticRef.current = null;
    setRenderTrigger(prev => prev + 1);
  }, []);

  const handleTouchCancel = useCallback(() => {
    clearLongPressTimer();
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    resetDragState();
  }, [clearLongPressTimer, resetDragState]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const preventContextMenu = (e: Event) => {
      if (dragStateRef.current.isDragging) {
        e.preventDefault();
      }
    };

    container.addEventListener('contextmenu', preventContextMenu);
    return () => {
      container.removeEventListener('contextmenu', preventContextMenu);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const setItemRef = useCallback((id: string, ref: HTMLDivElement | null) => {
    if (ref) {
      itemRefs.current.set(id, ref);
    } else {
      itemRefs.current.delete(id);
    }
  }, []);

  const setSectionRef = useCallback((id: string, ref: HTMLDivElement | null) => {
    if (ref) {
      sectionRefs.current.set(id, ref);
    } else {
      sectionRefs.current.delete(id);
    }
  }, []);

  // Get current drag state for rendering
  const dragState = dragStateRef.current;
  
  // Calculate total and visible task counts
  const totalTaskCount = items.filter(item => !item.completed).length;
  const visibleTaskCount = sortedSections.reduce((count, section) => {
    const currentLimit = expandedSectionLimits[section.id] || INITIAL_VISIBLE_ITEMS;
    const sectionTaskCount = items.filter(item => 
      !item.completed && (item.sectionId === section.id || (!item.sectionId && section.id === sections[0]?.id))
    ).length;
    return count + Math.min(sectionTaskCount, currentLimit);
  }, 0);
  
  const isVirtualizing = totalTaskCount > VIRTUALIZATION_THRESHOLD;

  return (
    <div 
      ref={containerRef}
      className={cn("relative space-y-4", className)}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      style={{ 
        touchAction: dragState.isDragging ? 'none' : 'auto',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      {/* Task Count Indicator - shows when virtualization is active */}
      {isVirtualizing && (
        <div className="sticky top-0 z-10 flex items-center justify-center py-2">
          <div className="bg-primary/10 text-primary text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-2">
            <span>Showing {visibleTaskCount} of {totalTaskCount} tasks</span>
            {visibleTaskCount < totalTaskCount && (
              <span className="text-primary/70">• Scroll to load more</span>
            )}
          </div>
        </div>
      )}
      
      {/* Global drop indicator - follows dragged item */}
      <div 
        ref={indicatorRef}
        className="absolute left-4 right-4 h-1 bg-blue-500 rounded-full z-[60] pointer-events-none"
        style={{ 
          opacity: 0,
          transition: 'top 0.05s linear',
        }}
      >
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-500 rounded-full" />
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-500 rounded-full" />
      </div>
      {sortedSections.map(section => {
        const allSectionTasks = items.filter(item => 
          !item.completed && (item.sectionId === section.id || (!item.sectionId && section.id === sections[0]?.id))
        );
        // Use dynamic limit based on expanded sections
        const currentLimit = expandedSectionLimits[section.id] || INITIAL_VISIBLE_ITEMS;
        const sectionTasks = allSectionTasks.slice(0, currentLimit);
        const hasMoreTasks = allSectionTasks.length > currentLimit;
        const hiddenCount = allSectionTasks.length - currentLimit;
        const isDropTargetSection = dragState.dropTarget?.type === 'section' && dragState.dropTarget.sectionId === section.id;

        const handleLoadMore = () => {
          setExpandedSectionLimits(prev => ({
            ...prev,
            [section.id]: (prev[section.id] || INITIAL_VISIBLE_ITEMS) + LOAD_MORE_INCREMENT
          }));
        };

        const handleShowLess = () => {
          setExpandedSectionLimits(prev => ({
            ...prev,
            [section.id]: INITIAL_VISIBLE_ITEMS
          }));
        };

        return (
          <div 
            key={section.id}
            ref={(ref) => setSectionRef(section.id, ref)}
            className={cn(
              "rounded-xl overflow-hidden border border-border/30 relative",
              isDropTargetSection && "ring-2 ring-primary bg-primary/5"
            )}
          >
            {renderSectionHeader(section, false)}
            
            {!section.isCollapsed && (
              <div 
                className="bg-background" 
                style={{ borderLeft: `4px solid ${section.color}` }}
              >
                {sectionTasks.length > 0 ? (
                  <>
                    {allSectionTasks.length > VIRTUALIZATION_THRESHOLD ? (
                      // Use virtualization for large sections
                      <VirtualizedSectionContent
                        tasks={sectionTasks}
                        expandedTasks={expandedTasks}
                        draggedItemId={dragState.draggedItem?.id || null}
                        draggedItemType={dragState.draggedItem?.type || null}
                        dropTargetTaskId={dragState.dropTarget?.type === 'subtask-area' ? dragState.dropTarget.taskId || null : null}
                        setItemRef={setItemRef}
                        handleTouchStart={handleTouchStart}
                        renderTask={renderTask}
                        renderSubtask={renderSubtask}
                      />
                    ) : (
                      // Standard rendering for small sections
                      <div className="divide-y divide-border/30">
                        {sectionTasks.map((item) => (
                          <MemoizedTaskRow
                            key={item.id}
                            item={item}
                            isDragging={dragState.draggedItem?.id === item.id && dragState.draggedItem?.type === 'task'}
                            isSubtaskDropTarget={dragState.dropTarget?.type === 'subtask-area' && dragState.dropTarget.taskId === item.id}
                            hasSubtasks={!!(item.subtasks && item.subtasks.length > 0)}
                            isExpanded={expandedTasks.has(item.id)}
                            subtasks={item.subtasks || []}
                            draggedItemId={dragState.draggedItem?.id || null}
                            draggedItemType={dragState.draggedItem?.type || null}
                            setItemRef={setItemRef}
                            handleTouchStart={handleTouchStart}
                            renderTask={renderTask}
                            renderSubtask={renderSubtask}
                          />
                        ))}
                      </div>
                    )}
                    {/* Infinite scroll trigger + Load More buttons */}
                    {hasMoreTasks && (
                      <InfiniteScrollTrigger 
                        onVisible={handleLoadMore}
                        hiddenCount={hiddenCount}
                        loadMoreIncrement={LOAD_MORE_INCREMENT}
                      />
                    )}
                    {currentLimit > INITIAL_VISIBLE_ITEMS && !hasMoreTasks && (
                      <div className="py-3 px-4 flex items-center justify-center bg-muted/20">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={handleShowLess}
                          className="text-xs gap-1 text-muted-foreground"
                        >
                          <ChevronUp className="h-3 w-3" />
                          Show less
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  renderEmptySection(section)
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default UnifiedDragDropList;