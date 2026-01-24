import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, Replace, X, ArrowLeft, Eraser, Trash2, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { sanitizeHtml } from '@/lib/sanitize';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';

interface FindReplacePageProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  onContentChange: (content: string) => void;
  editorRef: React.RefObject<HTMLDivElement>;
}

const HIGHLIGHT_COLOR = '#3c78f0';
const HIGHLIGHT_BG_COLOR = 'rgba(60, 120, 240, 0.3)';

export const FindReplacePage = ({
  isOpen,
  onClose,
  content,
  onContentChange,
  editorRef,
}: FindReplacePageProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [matchCount, setMatchCount] = useState(0);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  // Hardware back button support
  useHardwareBackButton({
    onBack: onClose,
    enabled: isOpen,
    priority: 'sheet',
  });

  // Close without clearing highlights - they persist until user exits notes
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Clear all highlights from the editor
  const clearHighlights = useCallback(() => {
    if (editorRef.current) {
      const highlights = editorRef.current.querySelectorAll('mark[data-find-highlight]');
      highlights.forEach((mark) => {
        const parent = mark.parentNode;
        if (parent) {
          const textNode = document.createTextNode(mark.textContent || '');
          parent.replaceChild(textNode, mark);
          parent.normalize();
        }
      });
    }
  }, [editorRef]);

  // Clear button handler - clears highlights and resets state
  const handleClear = useCallback(() => {
    clearHighlights();
    setSearchTerm('');
    setReplaceTerm('');
    setMatchCount(0);
    setCurrentMatchIndex(0);
    toast.success('Cleared');
  }, [clearHighlights]);

  // Escape special regex characters
  const escapeRegex = (str: string) => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  // Build regex pattern
  const buildSearchRegex = useCallback((term: string, forGlobal: boolean = false) => {
    if (!term.trim()) return null;
    
    const pattern = escapeRegex(term);
    const flags = forGlobal ? 'gi' : 'gi';
    
    try {
      return new RegExp(pattern, flags);
    } catch {
      return null;
    }
  }, []);

  // Find and highlight all matches
  const handleFind = useCallback(() => {
    if (!editorRef.current || !searchTerm.trim()) {
      clearHighlights();
      setMatchCount(0);
      toast.error('Please enter a search term');
      return;
    }

    // First clear existing highlights
    clearHighlights();

    const searchRegex = buildSearchRegex(searchTerm, true);
    if (!searchRegex) {
      setMatchCount(0);
      return;
    }

    let count = 0;

    const walker = document.createTreeWalker(
      editorRef.current,
      NodeFilter.SHOW_TEXT,
      null
    );

    const textNodes: Text[] = [];
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      if (node.textContent && searchRegex.test(node.textContent)) {
        textNodes.push(node);
      }
      searchRegex.lastIndex = 0;
    }

    textNodes.forEach((textNode) => {
      const text = textNode.textContent || '';
      const countRegex = buildSearchRegex(searchTerm, true);
      if (countRegex) {
        const matches = text.match(countRegex);
        if (matches) {
          count += matches.length;
        }
      }

      const fragment = document.createDocumentFragment();
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      const regex = buildSearchRegex(searchTerm, true);
      if (!regex) return;

      while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
          fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
        }

        const mark = document.createElement('mark');
        mark.setAttribute('data-find-highlight', 'true');
        mark.style.backgroundColor = HIGHLIGHT_BG_COLOR;
        mark.style.color = HIGHLIGHT_COLOR;
        mark.style.borderRadius = '2px';
        mark.style.padding = '0 2px';
        mark.textContent = match[0];
        fragment.appendChild(mark);

        lastIndex = regex.lastIndex;
      }

      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
      }

      textNode.parentNode?.replaceChild(fragment, textNode);
    });

    setMatchCount(count);
    setCurrentMatchIndex(count > 0 ? 1 : 0);

    if (count > 0) {
      // Scroll to first match
      const firstMatch = editorRef.current?.querySelector('mark[data-find-highlight]') as HTMLElement;
      if (firstMatch) {
        firstMatch.style.backgroundColor = HIGHLIGHT_COLOR;
        firstMatch.style.color = 'white';
        firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      toast.success(`Found ${count} match${count !== 1 ? 'es' : ''}`);
    } else {
      toast.error('No matches found');
    }
  }, [searchTerm, editorRef, clearHighlights, buildSearchRegex]);

  // Replace all matches
  const handleReplace = useCallback(() => {
    if (!editorRef.current || !searchTerm.trim()) {
      toast.error('Please enter a search term first');
      return;
    }

    if (matchCount === 0) {
      toast.error('No matches to replace. Click Find first.');
      return;
    }

    // Clear highlights first
    clearHighlights();

    // Get the content and replace all occurrences
    const currentContent = editorRef.current.innerHTML;
    const searchRegex = buildSearchRegex(searchTerm, true);
    if (!searchRegex) return;
    
    const newContent = currentContent.replace(searchRegex, replaceTerm);

    editorRef.current.innerHTML = sanitizeHtml(newContent);
    onContentChange(newContent);

    const replacedCount = matchCount;
    setMatchCount(0);
    setCurrentMatchIndex(0);

    toast.success(`Replaced ${replacedCount} occurrence${replacedCount !== 1 ? 's' : ''}`);
  }, [editorRef, matchCount, searchTerm, replaceTerm, onContentChange, clearHighlights, buildSearchRegex]);

  // Replace next (current) match only
  const handleReplaceNext = useCallback(() => {
    if (!editorRef.current || !searchTerm.trim()) {
      toast.error('Please enter a search term first');
      return;
    }

    if (matchCount === 0) {
      toast.error('No matches to replace. Click Find first.');
      return;
    }

    // Get all highlight marks
    const highlights = editorRef.current.querySelectorAll('mark[data-find-highlight]');
    if (highlights.length === 0) return;

    // Find the current highlighted match (the one with white background)
    let currentMark: HTMLElement | null = null;
    let currentIndex = 0;
    
    highlights.forEach((mark, index) => {
      const el = mark as HTMLElement;
      if (el.style.backgroundColor === HIGHLIGHT_COLOR || el.style.backgroundColor === 'rgb(60, 120, 240)') {
        currentMark = el;
        currentIndex = index;
      }
    });

    // If no current mark found, use the first one
    if (!currentMark && highlights.length > 0) {
      currentMark = highlights[0] as HTMLElement;
      currentIndex = 0;
    }

    if (currentMark) {
      // Replace the current mark with the replacement text
      const textNode = document.createTextNode(replaceTerm);
      currentMark.parentNode?.replaceChild(textNode, currentMark);
      
      // Update content
      if (editorRef.current) {
        onContentChange(editorRef.current.innerHTML);
      }

      // Update count
      const newCount = matchCount - 1;
      setMatchCount(newCount);

      if (newCount > 0) {
        // Highlight the next match
        const remainingHighlights = editorRef.current?.querySelectorAll('mark[data-find-highlight]');
        if (remainingHighlights && remainingHighlights.length > 0) {
          // Reset all to default style
          remainingHighlights.forEach((mark) => {
            const el = mark as HTMLElement;
            el.style.backgroundColor = HIGHLIGHT_BG_COLOR;
            el.style.color = HIGHLIGHT_COLOR;
          });
          
          // Highlight the next one (or first if we were at the end)
          const nextIndex = currentIndex >= remainingHighlights.length ? 0 : currentIndex;
          const nextMark = remainingHighlights[nextIndex] as HTMLElement;
          if (nextMark) {
            nextMark.style.backgroundColor = HIGHLIGHT_COLOR;
            nextMark.style.color = 'white';
            nextMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          
          setCurrentMatchIndex(nextIndex + 1);
        }
        toast.success(`Replaced 1 match (${newCount} remaining)`);
      } else {
        setCurrentMatchIndex(0);
        toast.success('Replaced last match');
      }
    }
  }, [editorRef, matchCount, searchTerm, replaceTerm, onContentChange]);

  // Remove all matches (replace with empty string)
  const handleRemove = useCallback(() => {
    if (!editorRef.current || !searchTerm.trim()) {
      toast.error('Please enter a search term first');
      return;
    }

    if (matchCount === 0) {
      toast.error('No matches to remove. Click Find first.');
      return;
    }

    // Clear highlights first
    clearHighlights();

    // Get the content and remove all occurrences
    const currentContent = editorRef.current.innerHTML;
    const searchRegex = buildSearchRegex(searchTerm, true);
    if (!searchRegex) return;
    
    const newContent = currentContent.replace(searchRegex, '');

    editorRef.current.innerHTML = sanitizeHtml(newContent);
    onContentChange(newContent);

    const removedCount = matchCount;
    setMatchCount(0);
    setCurrentMatchIndex(0);
    setSearchTerm('');

    toast.success(`Removed ${removedCount} occurrence${removedCount !== 1 ? 's' : ''}`);
  }, [editorRef, matchCount, searchTerm, onContentChange, clearHighlights, buildSearchRegex]);

  if (!isOpen) return null;

  return (
    <div className={cn(
      "fixed inset-0 bg-background z-50 flex flex-col transition-transform duration-300",
      isOpen ? "translate-x-0" : "translate-x-full"
    )}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <Button variant="ghost" size="sm" onClick={handleClose}>
          <ArrowLeft className="h-5 w-5 mr-1" />
          Back
        </Button>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Search className="h-5 w-5" style={{ color: HIGHLIGHT_COLOR }} />
          Find & Replace
        </h2>
        <div className="w-16" /> {/* Spacer for centering */}
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-lg mx-auto space-y-6">
          {/* Find Input */}
          <div className="space-y-2">
            <Label className="text-base font-medium" style={{ color: HIGHLIGHT_COLOR }}>
              Find
            </Label>
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Enter text to find..."
              className="h-12 text-base"
              autoFocus
            />
            {matchCount > 0 && (
              <p className="text-sm text-muted-foreground">
                Match <strong style={{ color: HIGHLIGHT_COLOR }}>{currentMatchIndex}</strong> of <strong style={{ color: HIGHLIGHT_COLOR }}>{matchCount}</strong>
              </p>
            )}
          </div>

          {/* Replace Input */}
          <div className="space-y-2">
            <Label className="text-base font-medium" style={{ color: HIGHLIGHT_COLOR }}>
              Replace with
            </Label>
            <Input
              value={replaceTerm}
              onChange={(e) => setReplaceTerm(e.target.value)}
              placeholder="Enter replacement text..."
              className="h-12 text-base"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleFind}
              className="flex-1 h-12 text-base"
              style={{ backgroundColor: HIGHLIGHT_COLOR }}
            >
              <Search className="h-5 w-5 mr-2" />
              Find
            </Button>
            <Button
              onClick={handleReplaceNext}
              disabled={matchCount === 0}
              variant="outline"
              className="flex-1 h-12 text-base"
              style={{ 
                borderColor: HIGHLIGHT_COLOR,
                color: matchCount > 0 ? HIGHLIGHT_COLOR : undefined,
              }}
            >
              <ChevronRight className="h-5 w-5 mr-1" />
              Replace Next
            </Button>
          </div>

          {/* Replace All Button */}
          <Button
            onClick={handleReplace}
            disabled={matchCount === 0}
            variant="outline"
            className="w-full h-12 text-base"
            style={{ 
              borderColor: HIGHLIGHT_COLOR,
              color: matchCount > 0 ? HIGHLIGHT_COLOR : undefined,
            }}
          >
            <Replace className="h-5 w-5 mr-2" />
            Replace All
          </Button>

          {/* Remove Button */}
          <Button
            onClick={handleRemove}
            disabled={matchCount === 0}
            variant="outline"
            className="w-full h-12 text-base border-destructive text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-5 w-5 mr-2" />
            Remove All Matches
          </Button>

          {/* Clear Button */}
          <Button
            onClick={handleClear}
            variant="ghost"
            className="w-full h-12 text-base text-muted-foreground"
          >
            <Eraser className="h-5 w-5 mr-2" />
            Clear
          </Button>
        </div>
      </div>
    </div>
  );
};
