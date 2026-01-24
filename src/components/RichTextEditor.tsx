import { useCallback, useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Link as LinkIcon,
  Image as ImageIcon,
  List,
  ListOrdered,
  Palette,
  Highlighter,
  Undo,
  Redo,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  TextCursorInput,
  Link2,
  Table,
  Star,
  Paperclip,
  FileIcon,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { sanitizeHtml } from '@/lib/sanitize';
import { TableEditor, generateTableHTML, TableContextMenu, TableStyle } from './TableEditor';
import { WordToolbar } from './WordToolbar';
import { getSetting, setSetting } from '@/utils/settingsStorage';
import { autoCalculate } from '@/utils/autoCalculator';

// Favorites storage helpers
const FAVORITES_KEY = 'note-font-favorites';
const getFavorites = async (): Promise<string[]> => {
  return getSetting<string[]>(FAVORITES_KEY, []);
};
const saveFavorites = (favorites: string[]) => {
  setSetting(FAVORITES_KEY, favorites);
};

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  onImageAdd?: (imageUrl: string) => void;
  allowImages?: boolean;
  showTable?: boolean;
  className?: string;
  toolbarPosition?: 'top' | 'bottom';
  title?: string;
  onTitleChange?: (title: string) => void;
  showTitle?: boolean;
  fontFamily?: string;
  onFontFamilyChange?: (fontFamily: string) => void;
  fontSize?: string;
  onFontSizeChange?: (fontSize: string) => void;
  fontWeight?: string;
  onFontWeightChange?: (fontWeight: string) => void;
  letterSpacing?: string;
  onLetterSpacingChange?: (letterSpacing: string) => void;
  isItalic?: boolean;
  onItalicChange?: (isItalic: boolean) => void;
  lineHeight?: string;
  onLineHeightChange?: (lineHeight: string) => void;
  onInsertNoteLink?: () => void;
  externalEditorRef?: React.RefObject<HTMLDivElement>;
}

const COLORS = [
  // Neutrals
  { name: 'Black', value: '#000000' },
  { name: 'Dark Gray', value: '#374151' },
  { name: 'Gray', value: '#6B7280' },
  { name: 'Light Gray', value: '#9CA3AF' },
  { name: 'White', value: '#FFFFFF' },
  // Reds
  { name: 'Red', value: '#EF4444' },
  { name: 'Dark Red', value: '#B91C1C' },
  { name: 'Rose', value: '#F43F5E' },
  { name: 'Crimson', value: '#DC2626' },
  // Oranges
  { name: 'Orange', value: '#F97316' },
  { name: 'Dark Orange', value: '#EA580C' },
  { name: 'Amber', value: '#F59E0B' },
  // Yellows
  { name: 'Yellow', value: '#EAB308' },
  { name: 'Gold', value: '#CA8A04' },
  // Greens
  { name: 'Green', value: '#10B981' },
  { name: 'Dark Green', value: '#059669' },
  { name: 'Lime', value: '#84CC16' },
  { name: 'Emerald', value: '#34D399' },
  { name: 'Teal', value: '#14B8A6' },
  // Blues
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Dark Blue', value: '#1D4ED8' },
  { name: 'Sky Blue', value: '#0EA5E9' },
  { name: 'Cyan', value: '#06B6D4' },
  { name: 'Navy', value: '#1E3A8A' },
  // Purples
  { name: 'Purple', value: '#8B5CF6' },
  { name: 'Dark Purple', value: '#7C3AED' },
  { name: 'Violet', value: '#A855F7' },
  { name: 'Indigo', value: '#6366F1' },
  // Pinks
  { name: 'Pink', value: '#EC4899' },
  { name: 'Hot Pink', value: '#DB2777' },
  { name: 'Fuchsia', value: '#D946EF' },
  // Browns
  { name: 'Brown', value: '#92400E' },
  { name: 'Tan', value: '#A8A29E' },
];

const HIGHLIGHT_COLORS = [
  // Yellows
  { name: 'Yellow', value: '#FEF08A' },
  { name: 'Light Yellow', value: '#FEF9C3' },
  { name: 'Amber', value: '#FDE68A' },
  { name: 'Gold', value: '#FCD34D' },
  // Greens
  { name: 'Green', value: '#BBF7D0' },
  { name: 'Light Green', value: '#DCFCE7' },
  { name: 'Lime', value: '#D9F99D' },
  { name: 'Emerald', value: '#A7F3D0' },
  { name: 'Teal', value: '#99F6E4' },
  // Blues
  { name: 'Blue', value: '#BFDBFE' },
  { name: 'Light Blue', value: '#DBEAFE' },
  { name: 'Sky Blue', value: '#BAE6FD' },
  { name: 'Cyan', value: '#A5F3FC' },
  // Purples
  { name: 'Purple', value: '#E9D5FF' },
  { name: 'Light Purple', value: '#F3E8FF' },
  { name: 'Violet', value: '#DDD6FE' },
  { name: 'Indigo', value: '#C7D2FE' },
  // Pinks & Reds
  { name: 'Pink', value: '#FBCFE8' },
  { name: 'Light Pink', value: '#FCE7F3' },
  { name: 'Rose', value: '#FECDD3' },
  { name: 'Red', value: '#FECACA' },
  { name: 'Fuchsia', value: '#F5D0FE' },
  // Oranges
  { name: 'Orange', value: '#FED7AA' },
  { name: 'Light Orange', value: '#FFEDD5' },
  { name: 'Peach', value: '#FED7D7' },
  // Neutrals
  { name: 'Gray', value: '#E5E7EB' },
  { name: 'Light Gray', value: '#F3F4F6' },
];

const FONT_CATEGORIES = [
  {
    category: 'Popular',
    fonts: [
      { name: 'Default', value: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', sample: 'Clean & Modern' },
      { name: 'Roboto', value: '"Roboto", sans-serif', sample: 'Most Popular' },
      { name: 'Open Sans', value: '"Open Sans", sans-serif', sample: 'Web Favorite' },
      { name: 'Lato', value: '"Lato", sans-serif', sample: 'Elegant Sans' },
      { name: 'Montserrat', value: '"Montserrat", sans-serif', sample: 'Bold & Modern' },
      { name: 'Poppins', value: '"Poppins", sans-serif', sample: 'Geometric Style' },
      { name: 'Playfair Display', value: '"Playfair Display", serif', sample: 'Classic Elegance' },
      { name: 'Dancing Script', value: '"Dancing Script", cursive', sample: 'Beautiful Script' },
    ]
  },
  {
    category: 'Sans Serif',
    fonts: [
      { name: 'Inter', value: '"Inter", sans-serif', sample: 'Modern UI Font' },
      { name: 'Raleway', value: '"Raleway", sans-serif', sample: 'Thin & Stylish' },
      { name: 'Nunito', value: '"Nunito", sans-serif', sample: 'Rounded & Friendly' },
      { name: 'Ubuntu', value: '"Ubuntu", sans-serif', sample: 'Tech Friendly' },
      { name: 'Quicksand', value: '"Quicksand", sans-serif', sample: 'Light & Airy' },
      { name: 'Josefin Sans', value: '"Josefin Sans", sans-serif', sample: 'Vintage Modern' },
      { name: 'Work Sans', value: '"Work Sans", sans-serif', sample: 'Professional' },
      { name: 'PT Sans', value: '"PT Sans", sans-serif', sample: 'Readable Sans' },
      { name: 'Cabin', value: '"Cabin", sans-serif', sample: 'Humanist Style' },
      { name: 'Oswald', value: '"Oswald", sans-serif', sample: 'CONDENSED STYLE' },
      { name: 'Archivo', value: '"Archivo", sans-serif', sample: 'Grotesque Sans' },
      { name: 'Rubik', value: '"Rubik", sans-serif', sample: 'Rounded Corners' },
      { name: 'Karla', value: '"Karla", sans-serif', sample: 'Grotesque Style' },
      { name: 'Mulish', value: '"Mulish", sans-serif', sample: 'Clean Reading' },
      { name: 'DM Sans', value: '"DM Sans", sans-serif', sample: 'Low Contrast' },
      { name: 'Manrope', value: '"Manrope", sans-serif', sample: 'Modern Geometric' },
      { name: 'Outfit', value: '"Outfit", sans-serif', sample: 'Variable Width' },
      { name: 'Lexend', value: '"Lexend", sans-serif', sample: 'Easy Reading' },
      { name: 'Figtree', value: '"Figtree", sans-serif', sample: 'Friendly Sans' },
      { name: 'Source Sans Pro', value: '"Source Sans Pro", sans-serif', sample: 'Adobe Classic' },
      { name: 'Noto Sans', value: '"Noto Sans", sans-serif', sample: 'Universal' },
      { name: 'Barlow', value: '"Barlow", sans-serif', sample: 'Slightly Rounded' },
      { name: 'Exo 2', value: '"Exo 2", sans-serif', sample: 'Geometric Tech' },
      { name: 'Titillium Web', value: '"Titillium Web", sans-serif', sample: 'Academic Style' },
    ]
  },
  {
    category: 'Serif',
    fonts: [
      { name: 'Merriweather', value: '"Merriweather", serif', sample: 'Reading Comfort' },
      { name: 'Crimson Text', value: '"Crimson Text", serif', sample: 'Book Typography' },
      { name: 'Noto Serif', value: '"Noto Serif", serif', sample: 'Classic Style' },
      { name: 'Lora', value: '"Lora", serif', sample: 'Contemporary Serif' },
      { name: 'Libre Baskerville', value: '"Libre Baskerville", serif', sample: 'Web Optimized' },
      { name: 'EB Garamond', value: '"EB Garamond", serif', sample: 'Old Style' },
      { name: 'Cormorant', value: '"Cormorant", serif', sample: 'Display Serif' },
      { name: 'Bitter', value: '"Bitter", serif', sample: 'Slab Serif' },
      { name: 'Spectral', value: '"Spectral", serif', sample: 'Screen Reading' },
      { name: 'PT Serif', value: '"PT Serif", serif', sample: 'Russian Serif' },
      { name: 'Vollkorn', value: '"Vollkorn", serif', sample: 'Body Text' },
      { name: 'Alegreya', value: '"Alegreya", serif', sample: 'Literary Style' },
    ]
  },
  {
    category: 'Handwritten',
    fonts: [
      { name: 'Pacifico', value: '"Pacifico", cursive', sample: 'Fun & Playful' },
      { name: 'Indie Flower', value: '"Indie Flower", cursive', sample: 'Hand Written' },
      { name: 'Shadows Into Light', value: '"Shadows Into Light", cursive', sample: 'Sketchy Notes' },
      { name: 'Permanent Marker', value: '"Permanent Marker", cursive', sample: 'Bold Marker' },
      { name: 'Caveat', value: '"Caveat", cursive', sample: 'Quick Notes' },
      { name: 'Satisfy', value: '"Satisfy", cursive', sample: 'Brush Script' },
      { name: 'Kalam', value: '"Kalam", cursive', sample: 'Handwritten Style' },
      { name: 'Patrick Hand', value: '"Patrick Hand", cursive', sample: 'Friendly Notes' },
      { name: 'Architects Daughter', value: '"Architects Daughter", cursive', sample: 'Blueprint Style' },
      { name: 'Amatic SC', value: '"Amatic SC", cursive', sample: 'CONDENSED HAND' },
      { name: 'Covered By Your Grace', value: '"Covered By Your Grace", cursive', sample: 'Casual Script' },
      { name: 'Gloria Hallelujah', value: '"Gloria Hallelujah", cursive', sample: 'Comic Hand' },
      { name: 'Handlee', value: '"Handlee", cursive', sample: 'Loose Handwriting' },
      { name: 'Just Another Hand', value: '"Just Another Hand", cursive', sample: 'Quick Scribble' },
      { name: 'Neucha', value: '"Neucha", cursive', sample: 'Russian Hand' },
      { name: 'Nothing You Could Do', value: '"Nothing You Could Do", cursive', sample: 'Casual Flow' },
      { name: 'Reenie Beanie', value: '"Reenie Beanie", cursive', sample: 'Quick Note' },
      { name: 'Rock Salt', value: '"Rock Salt", cursive', sample: 'Rough Marker' },
      { name: 'Schoolbell', value: '"Schoolbell", cursive', sample: 'Classroom Style' },
      { name: 'Waiting for the Sunrise', value: '"Waiting for the Sunrise", cursive', sample: 'Dreamy Script' },
      { name: 'Zeyada', value: '"Zeyada", cursive', sample: 'Artistic Hand' },
      { name: 'Homemade Apple', value: '"Homemade Apple", cursive', sample: 'Natural Writing' },
      { name: 'Loved by the King', value: '"Loved by the King", cursive', sample: 'Royal Script' },
      { name: 'La Belle Aurore', value: '"La Belle Aurore", cursive', sample: 'French Elegance' },
      { name: 'Sacramento', value: '"Sacramento", cursive', sample: 'Elegant Script' },
      { name: 'Great Vibes', value: '"Great Vibes", cursive', sample: 'Formal Script' },
      { name: 'Allura', value: '"Allura", cursive', sample: 'Wedding Style' },
      { name: 'Alex Brush', value: '"Alex Brush", cursive', sample: 'Brush Lettering' },
      { name: 'Tangerine', value: '"Tangerine", cursive', sample: 'Calligraphy' },
      { name: 'Yellowtail', value: '"Yellowtail", cursive', sample: 'Retro Script' },
      { name: 'Marck Script', value: '"Marck Script", cursive', sample: 'Casual Elegant' },
      { name: 'Courgette', value: '"Courgette", cursive', sample: 'Medium Weight' },
      { name: 'Cookie', value: '"Cookie", cursive', sample: 'Sweet Script' },
      { name: 'Damion', value: '"Damion", cursive', sample: 'Bold Script' },
      { name: 'Mr Dafoe', value: '"Mr Dafoe", cursive', sample: 'Signature Style' },
      { name: 'Niconne', value: '"Niconne", cursive', sample: 'Romantic' },
      { name: 'Norican', value: '"Norican", cursive', sample: 'Flowing Script' },
      { name: 'Pinyon Script', value: '"Pinyon Script", cursive', sample: 'Formal Cursive' },
      { name: 'Rouge Script', value: '"Rouge Script", cursive', sample: 'Vintage Hand' },
    ]
  },
  {
    category: 'Display & Decorative',
    fonts: [
      { name: 'Bebas Neue', value: '"Bebas Neue", cursive', sample: 'BOLD HEADLINES' },
      { name: 'Lobster', value: '"Lobster", cursive', sample: 'Retro Script' },
      { name: 'Righteous', value: '"Righteous", cursive', sample: 'Groovy Display' },
      { name: 'Alfa Slab One', value: '"Alfa Slab One", serif', sample: 'Heavy Slab' },
      { name: 'Fredoka One', value: '"Fredoka One", cursive', sample: 'Rounded Fun' },
      { name: 'Bangers', value: '"Bangers", cursive', sample: 'COMIC STYLE' },
      { name: 'Russo One', value: '"Russo One", sans-serif', sample: 'Sporty Bold' },
      { name: 'Bungee', value: '"Bungee", cursive', sample: 'VERTICAL DISPLAY' },
      { name: 'Passion One', value: '"Passion One", cursive', sample: 'BOLD IMPACT' },
      { name: 'Monoton', value: '"Monoton", cursive', sample: 'NEON STYLE' },
    ]
  },
  {
    category: 'Monospace',
    fonts: [
      { name: 'Courier Prime', value: '"Courier Prime", monospace', sample: 'const code = true;' },
      { name: 'Space Mono', value: '"Space Mono", monospace', sample: 'function() {}' },
      { name: 'Fira Code', value: '"Fira Code", monospace', sample: '=> !== ===' },
      { name: 'Source Code Pro', value: '"Source Code Pro", monospace', sample: 'console.log()' },
      { name: 'JetBrains Mono', value: '"JetBrains Mono", monospace', sample: 'let x = 42;' },
      { name: 'IBM Plex Mono', value: '"IBM Plex Mono", monospace', sample: 'import { }' },
      { name: 'Roboto Mono', value: '"Roboto Mono", monospace', sample: 'async await' },
      { name: 'Inconsolata', value: '"Inconsolata", monospace', sample: 'if (true) {}' },
    ]
  }
];

// Helper to get all fonts flattened
const getAllFonts = () => {
  return FONT_CATEGORIES.flatMap(cat => cat.fonts);
};

const FONT_WEIGHTS = [
  { name: 'Light', value: '300' },
  { name: 'Regular', value: '400' },
  { name: 'Medium', value: '500' },
  { name: 'Semi Bold', value: '600' },
  { name: 'Bold', value: '700' },
];

const FONT_SIZES = [
  { name: 'Extra Small', value: '12px' },
  { name: 'Small', value: '14px' },
  { name: 'Medium', value: '16px' },
  { name: 'Large', value: '20px' },
  { name: 'Extra Large', value: '24px' },
  { name: 'Huge', value: '32px' },
];

const LETTER_SPACINGS = [
  { name: 'Tight', value: '-0.05em', sample: 'Compressed' },
  { name: 'Normal', value: '0em', sample: 'Default spacing' },
  { name: 'Wide', value: '0.05em', sample: 'Slightly spaced' },
  { name: 'Wider', value: '0.1em', sample: 'More spacing' },
  { name: 'Widest', value: '0.2em', sample: 'Maximum space' },
];

const LINE_HEIGHTS = [
  { name: 'Compact', value: '1.2', sample: 'Tight lines' },
  { name: 'Normal', value: '1.5', sample: 'Default height' },
  { name: 'Relaxed', value: '1.75', sample: 'More breathing room' },
  { name: 'Loose', value: '2', sample: 'Double spaced' },
  { name: 'Extra Loose', value: '2.5', sample: 'Maximum space' },
];

export const RichTextEditor = ({
  content,
  onChange,
  onImageAdd,
  allowImages = true,
  showTable = true,
  className = '',
  toolbarPosition = 'top',
  title = '',
  onTitleChange,
  showTitle = false,
  fontFamily = FONT_CATEGORIES[0].fonts[0].value,
  onFontFamilyChange,
  fontSize = FONT_SIZES[2].value,
  onFontSizeChange,
  fontWeight = FONT_WEIGHTS[1].value,
  onFontWeightChange,
  letterSpacing = LETTER_SPACINGS[1].value,
  onLetterSpacingChange,
  isItalic = false,
  onItalicChange,
  lineHeight = LINE_HEIGHTS[1].value,
  onLineHeightChange,
  onInsertNoteLink,
  externalEditorRef,
}: RichTextEditorProps) => {
  const { t } = useTranslation();
  const internalEditorRef = useRef<HTMLDivElement>(null);
  const editorRef = externalEditorRef || internalEditorRef;
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const [history, setHistory] = useState<string[]>([content]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [fontPickerOpen, setFontPickerOpen] = useState(false);
  const [fontSizePickerOpen, setFontSizePickerOpen] = useState(false);
  const [favoriteFonts, setFavoriteFonts] = useState<string[]>([]);
  const [zoom, setZoom] = useState(100);
  const [textDirection, setTextDirection] = useState<'ltr' | 'rtl'>('ltr');
  
  // Table context menu state
  const [tableContextMenu, setTableContextMenu] = useState<{
    table: HTMLTableElement;
    rowIndex: number;
    colIndex: number;
    position: { x: number; y: number };
  } | null>(null);
  
  // Active formatting states
  const [activeStates, setActiveStates] = useState({
    isBold: false,
    isItalic: false,
    isUnderline: false,
    isStrikethrough: false,
    isSubscript: false,
    isSuperscript: false,
    alignment: 'left' as 'left' | 'center' | 'right' | 'justify',
    isBulletList: false,
    isNumberedList: false,
  });

  // Update active states based on current selection
  const updateActiveStates = useCallback(() => {
    try {
      const isBold = document.queryCommandState('bold');
      const isItalic = document.queryCommandState('italic');
      const isUnderline = document.queryCommandState('underline');
      const isStrikethrough = document.queryCommandState('strikeThrough');
      const isSubscript = document.queryCommandState('subscript');
      const isSuperscript = document.queryCommandState('superscript');
      const isBulletList = document.queryCommandState('insertUnorderedList');
      const isNumberedList = document.queryCommandState('insertOrderedList');
      
      let alignment: 'left' | 'center' | 'right' | 'justify' = 'left';
      if (document.queryCommandState('justifyCenter')) alignment = 'center';
      else if (document.queryCommandState('justifyRight')) alignment = 'right';
      else if (document.queryCommandState('justifyFull')) alignment = 'justify';
      
      setActiveStates({ isBold, isItalic, isUnderline, isStrikethrough, isSubscript, isSuperscript, alignment, isBulletList, isNumberedList });
    } catch (e) {
      // queryCommandState may fail in some contexts
    }
  }, []);

  // Listen to selection changes to update formatting states
  useEffect(() => {
    const handleSelectionChange = () => {
      if (editorRef.current?.contains(document.activeElement) || 
          document.activeElement === editorRef.current) {
        updateActiveStates();
      }
    };
    
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [updateActiveStates]);

  const toggleFavorite = useCallback((fontValue: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavoriteFonts(prev => {
      const newFavorites = prev.includes(fontValue)
        ? prev.filter(f => f !== fontValue)
        : [...prev, fontValue];
      saveFavorites(newFavorites);
      return newFavorites;
    });
  }, []);
  
  // Track if we're in a composition (IME/autocomplete) to prevent crashes on Android
  const isComposingRef = useRef(false);
  // Track if the last change came from user input to avoid unnecessary innerHTML updates
  const isUserInputRef = useRef(false);

  const execCommand = useCallback((command: string, value?: string) => {
    try {
      editorRef.current?.focus();
      document.execCommand(command, false, value);
      editorRef.current?.focus();
    } catch (error) {
      console.error('Error executing command:', command, error);
    }
  }, []);

  const handleBold = () => execCommand('bold');
  const handleItalic = () => execCommand('italic');
  const handleUnderline = () => execCommand('underline');
  const handleStrikethrough = () => execCommand('strikeThrough');
  const handleSubscript = () => execCommand('subscript');
  const handleSuperscript = () => execCommand('superscript');
  const handleClearFormatting = () => execCommand('removeFormat');
  const handleCodeBlock = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const selectedText = range.toString();
    if (selectedText) {
      const code = document.createElement('code');
      code.style.backgroundColor = 'hsl(var(--muted))';
      code.style.padding = '2px 6px';
      code.style.borderRadius = '4px';
      code.style.fontFamily = 'monospace';
      code.textContent = selectedText;
      range.deleteContents();
      range.insertNode(code);
    }
  };
  const handleHorizontalRule = () => execCommand('insertHorizontalRule');
  const handleBlockquote = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const selectedText = range.toString() || 'Quote text here...';
    const blockquote = document.createElement('blockquote');
    blockquote.style.borderLeft = '4px solid hsl(var(--primary))';
    blockquote.style.paddingLeft = '16px';
    blockquote.style.marginLeft = '0';
    blockquote.style.marginTop = '8px';
    blockquote.style.marginBottom = '8px';
    blockquote.style.fontStyle = 'italic';
    blockquote.style.color = 'hsl(var(--muted-foreground))';
    blockquote.textContent = selectedText;
    range.deleteContents();
    range.insertNode(blockquote);
  };
  const handleBulletList = () => execCommand('insertUnorderedList');
  const handleNumberedList = () => execCommand('insertOrderedList');

  const handleFontSize = (size: string) => {
    // Use fontSize command - convert to 1-7 scale or use CSS
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    if (range.collapsed) {
      // No selection - apply to future text
      execCommand('fontSize', '3'); // Placeholder, we'll wrap in span
      return;
    }
    
    // Wrap selection in span with font-size
    const span = document.createElement('span');
    span.style.fontSize = `${size}px`;
    
    try {
      const contents = range.extractContents();
      span.appendChild(contents);
      range.insertNode(span);
      
      // Restore selection
      selection.removeAllRanges();
      const newRange = document.createRange();
      newRange.selectNodeContents(span);
      selection.addRange(newRange);
      
      // Trigger change
      if (editorRef.current) {
        const event = new Event('input', { bubbles: true });
        editorRef.current.dispatchEvent(event);
      }
    } catch (e) {
      console.error('Error applying font size:', e);
    }
  };

  const handleTextColor = (color: string) => {
    execCommand('foreColor', color);
  };

  const handleHighlight = (color: string) => {
    execCommand('hiliteColor', color);
  };

  const handleLink = () => {
    if (linkUrl) {
      const selection = window.getSelection();
      if (savedRangeRef.current && selection) {
        try {
          selection.removeAllRanges();
          selection.addRange(savedRangeRef.current);
        } catch (e) {
          // ignore
        }
      }
      const selectedText = selection?.toString();
      if (!selectedText) {
        toast.error('Please select text first');
        return;
      }
      execCommand('createLink', linkUrl);
      setLinkUrl('');
      setShowLinkInput(false);
      toast.success('Link inserted');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const imageUrl = reader.result as string;

        // Insert image at cursor position with resizable wrapper
        if (editorRef.current) {
          editorRef.current.focus();

          // Create a wrapper div for the resizable image
          const wrapper = document.createElement('div');
          wrapper.className = 'resizable-image-wrapper';
          wrapper.contentEditable = 'false';
          wrapper.style.display = 'block';
          wrapper.style.position = 'relative';
          wrapper.style.margin = '10px 0';
          wrapper.style.width = 'fit-content';
          wrapper.setAttribute('data-image-width', '300');
          wrapper.setAttribute('data-image-align', 'left');

          const img = document.createElement('img');
          img.src = imageUrl;
          img.style.width = '300px';
          img.style.height = 'auto';
          img.style.display = 'block';
          img.style.borderRadius = '8px';
          img.style.pointerEvents = 'none';
          img.draggable = false;

          // Create resize handle
          const resizeHandle = document.createElement('div');
          resizeHandle.className = 'image-resize-handle';
          resizeHandle.style.position = 'absolute';
          resizeHandle.style.bottom = '-4px';
          resizeHandle.style.right = '-4px';
          resizeHandle.style.width = '16px';
          resizeHandle.style.height = '16px';
          resizeHandle.style.backgroundColor = 'hsl(var(--primary))';
          resizeHandle.style.borderRadius = '50%';
          resizeHandle.style.cursor = 'se-resize';
          resizeHandle.style.display = 'none';
          resizeHandle.style.zIndex = '10';

          // Create delete handle
          const deleteHandle = document.createElement('div');
          deleteHandle.className = 'image-delete-handle';
          deleteHandle.style.position = 'absolute';
          deleteHandle.style.top = '-4px';
          deleteHandle.style.right = '-4px';
          deleteHandle.style.width = '16px';
          deleteHandle.style.height = '16px';
          deleteHandle.style.backgroundColor = 'hsl(var(--destructive))';
          deleteHandle.style.borderRadius = '50%';
          deleteHandle.style.cursor = 'pointer';
          deleteHandle.style.display = 'none';
          deleteHandle.style.zIndex = '10';
          deleteHandle.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

          // Create alignment toolbar
          const alignToolbar = document.createElement('div');
          alignToolbar.className = 'image-align-toolbar';
          alignToolbar.style.position = 'absolute';
          alignToolbar.style.bottom = '-32px';
          alignToolbar.style.left = '50%';
          alignToolbar.style.transform = 'translateX(-50%)';
          alignToolbar.style.display = 'none';
          alignToolbar.style.flexDirection = 'row';
          alignToolbar.style.gap = '4px';
          alignToolbar.style.padding = '4px';
          alignToolbar.style.backgroundColor = 'hsl(var(--background))';
          alignToolbar.style.border = '1px solid hsl(var(--border))';
          alignToolbar.style.borderRadius = '6px';
          alignToolbar.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
          alignToolbar.style.zIndex = '20';

          const createAlignButton = (align: 'left' | 'center' | 'right', icon: string) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.innerHTML = icon;
            btn.style.width = '28px';
            btn.style.height = '28px';
            btn.style.display = 'flex';
            btn.style.alignItems = 'center';
            btn.style.justifyContent = 'center';
            btn.style.border = 'none';
            btn.style.borderRadius = '4px';
            btn.style.backgroundColor = 'transparent';
            btn.style.cursor = 'pointer';
            btn.style.color = 'hsl(var(--foreground))';
            btn.onmouseenter = () => { btn.style.backgroundColor = 'hsl(var(--muted))'; };
            btn.onmouseleave = () => { btn.style.backgroundColor = 'transparent'; };
            btn.onclick = (e) => {
              e.stopPropagation();
              wrapper.setAttribute('data-image-align', align);
              if (align === 'left') {
                wrapper.style.marginLeft = '0';
                wrapper.style.marginRight = 'auto';
              } else if (align === 'center') {
                wrapper.style.marginLeft = 'auto';
                wrapper.style.marginRight = 'auto';
              } else {
                wrapper.style.marginLeft = 'auto';
                wrapper.style.marginRight = '0';
              }
              handleInput();
              toast.success(`Image aligned ${align}`);
            };
            return btn;
          };

          const leftIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="3" y1="6" y2="6"/><line x1="15" x2="3" y1="12" y2="12"/><line x1="17" x2="3" y1="18" y2="18"/></svg>';
          const centerIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="3" y1="6" y2="6"/><line x1="17" x2="7" y1="12" y2="12"/><line x1="19" x2="5" y1="18" y2="18"/></svg>';
          const rightIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="3" y1="6" y2="6"/><line x1="21" x2="9" y1="12" y2="12"/><line x1="21" x2="7" y1="18" y2="18"/></svg>';

          alignToolbar.appendChild(createAlignButton('left', leftIcon));
          alignToolbar.appendChild(createAlignButton('center', centerIcon));
          alignToolbar.appendChild(createAlignButton('right', rightIcon));

          wrapper.appendChild(img);
          wrapper.appendChild(resizeHandle);
          wrapper.appendChild(deleteHandle);
          wrapper.appendChild(alignToolbar);

          // Delete image on click
          deleteHandle.addEventListener('click', (e) => {
            e.stopPropagation();
            wrapper.remove();
            handleInput();
            toast.success('Image deleted');
          });

          // Show handles on click
          wrapper.addEventListener('click', (e) => {
            e.stopPropagation();
            // Hide all other handles
            document.querySelectorAll('.resizable-image-wrapper').forEach(w => {
              const handles = w.querySelectorAll('.image-resize-handle, .image-delete-handle, .image-align-toolbar');
              handles.forEach(h => (h as HTMLElement).style.display = 'none');
              (w as HTMLElement).style.outline = 'none';
            });
            // Show this wrapper's handles
            resizeHandle.style.display = 'block';
            deleteHandle.style.display = 'block';
            alignToolbar.style.display = 'flex';
            wrapper.style.outline = '2px solid hsl(var(--primary))';
            wrapper.style.outlineOffset = '2px';
          });

          // Resize functionality
          let isResizing = false;
          let startX = 0;
          let startWidth = 0;

          resizeHandle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            isResizing = true;
            startX = e.clientX;
            startWidth = img.offsetWidth;
            document.addEventListener('mousemove', onResizeMove);
            document.addEventListener('mouseup', onResizeEnd);
          });

          resizeHandle.addEventListener('touchstart', (e) => {
            e.stopPropagation();
            isResizing = true;
            startX = e.touches[0].clientX;
            startWidth = img.offsetWidth;
            document.addEventListener('touchmove', onResizeTouchMove);
            document.addEventListener('touchend', onResizeEnd);
          });

          const onResizeMove = (e: MouseEvent) => {
            if (!isResizing) return;
            const deltaX = e.clientX - startX;
            const newWidth = Math.max(50, Math.min(800, startWidth + deltaX));
            img.style.width = `${newWidth}px`;
            wrapper.style.width = 'fit-content';
            wrapper.setAttribute('data-image-width', String(newWidth));
          };

          const onResizeTouchMove = (e: TouchEvent) => {
            if (!isResizing) return;
            const deltaX = e.touches[0].clientX - startX;
            const newWidth = Math.max(50, Math.min(800, startWidth + deltaX));
            img.style.width = `${newWidth}px`;
            wrapper.style.width = 'fit-content';
            wrapper.setAttribute('data-image-width', String(newWidth));
          };

          const onResizeEnd = () => {
            isResizing = false;
            document.removeEventListener('mousemove', onResizeMove);
            document.removeEventListener('mouseup', onResizeEnd);
            document.removeEventListener('touchmove', onResizeTouchMove);
            document.removeEventListener('touchend', onResizeEnd);
            handleInput();
          };

          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.deleteContents();
            range.insertNode(wrapper);

            // Add paragraph after wrapper for proper cursor placement (especially for lined notes)
            const afterParagraph = document.createElement('p');
            afterParagraph.innerHTML = '<br>';
            range.setStartAfter(wrapper);
            range.insertNode(afterParagraph);

            // Move cursor to the new paragraph
            range.setStart(afterParagraph, 0);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
          } else {
            editorRef.current.appendChild(wrapper);
            // Add paragraph after for cursor placement
            const afterParagraph = document.createElement('p');
            afterParagraph.innerHTML = '<br>';
            editorRef.current.appendChild(afterParagraph);
          }

          // Trigger onChange to save content
          handleInput();
          toast.success('Image added - click to resize or move');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle file attachment upload (any file type)
  const handleFileAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const fileDataUrl = reader.result as string;

        if (editorRef.current) {
          editorRef.current.focus();

          // Create file attachment element
          const wrapper = document.createElement('div');
          wrapper.className = 'file-attachment-wrapper';
          wrapper.contentEditable = 'false';
          wrapper.style.display = 'inline-flex';
          wrapper.style.alignItems = 'center';
          wrapper.style.gap = '8px';
          wrapper.style.padding = '8px 12px';
          wrapper.style.margin = '8px 0';
          wrapper.style.backgroundColor = 'hsl(var(--muted))';
          wrapper.style.borderRadius = '8px';
          wrapper.style.border = '1px solid hsl(var(--border))';
          wrapper.style.maxWidth = '100%';
          wrapper.setAttribute('data-file-name', file.name);
          wrapper.setAttribute('data-file-type', file.type);
          wrapper.setAttribute('data-file-size', file.size.toString());

          // File icon
          const icon = document.createElement('div');
          icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>`;
          icon.style.flexShrink = '0';
          icon.style.color = 'hsl(var(--primary))';

          // File info
          const info = document.createElement('div');
          info.style.overflow = 'hidden';
          
          const fileName = document.createElement('div');
          fileName.textContent = file.name;
          fileName.style.fontWeight = '500';
          fileName.style.fontSize = '14px';
          fileName.style.textOverflow = 'ellipsis';
          fileName.style.overflow = 'hidden';
          fileName.style.whiteSpace = 'nowrap';
          
          const fileSize = document.createElement('div');
          const sizeInKB = (file.size / 1024).toFixed(1);
          const sizeInMB = (file.size / (1024 * 1024)).toFixed(1);
          fileSize.textContent = file.size > 1024 * 1024 ? `${sizeInMB} MB` : `${sizeInKB} KB`;
          fileSize.style.fontSize = '12px';
          fileSize.style.color = 'hsl(var(--muted-foreground))';
          
          info.appendChild(fileName);
          info.appendChild(fileSize);

          // Download link (hidden but stores the data)
          const downloadLink = document.createElement('a');
          downloadLink.href = fileDataUrl;
          downloadLink.download = file.name;
          downloadLink.style.display = 'none';
          downloadLink.className = 'file-download-link';

          // Click handler to download
          wrapper.style.cursor = 'pointer';
          wrapper.onclick = (ev) => {
            ev.preventDefault();
            downloadLink.click();
          };

          wrapper.appendChild(icon);
          wrapper.appendChild(info);
          wrapper.appendChild(downloadLink);

          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.deleteContents();
            
            // Add line break before
            const br1 = document.createElement('br');
            range.insertNode(br1);
            range.setStartAfter(br1);
            
            range.insertNode(wrapper);

            // Add line break after and move cursor
            const br2 = document.createElement('br');
            range.setStartAfter(wrapper);
            range.insertNode(br2);
            range.setStartAfter(br2);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
          } else {
            editorRef.current.appendChild(document.createElement('br'));
            editorRef.current.appendChild(wrapper);
            editorRef.current.appendChild(document.createElement('br'));
          }

          handleInput();
          toast.success(`File "${file.name}" attached`);
        }
      };
      reader.readAsDataURL(file);
    }
    // Reset input
    if (attachmentInputRef.current) {
      attachmentInputRef.current.value = '';
    }
  };

  // Click outside to deselect images
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.resizable-image-wrapper')) {
        document.querySelectorAll('.resizable-image-wrapper').forEach(w => {
          const handles = w.querySelectorAll('.image-resize-handle, .image-delete-handle, .image-align-toolbar');
          handles.forEach(h => (h as HTMLElement).style.display = 'none');
          (w as HTMLElement).style.outline = 'none';
        });
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Auto-capitalize first letter of new sentences
  const autoCapitalize = useCallback((text: string): string => {
    // Capitalize after: start of text, period+space, newline, exclamation, question mark
    return text.replace(/(^|[.!?]\s+|\n)([a-z])/g, (match, prefix, letter) => {
      return prefix + letter.toUpperCase();
    });
  }, []);

  // Debounced onChange for large content
  const debouncedOnChangeRef = useRef<NodeJS.Timeout | null>(null);
  const lastContentRef = useRef<string>('');
  
  const handleInput = () => {
    try {
      if (editorRef.current) {
        // Mark that this change came from user input
        isUserInputRef.current = true;
        const newContent = editorRef.current.innerHTML;
        
        // Skip if content hasn't changed (prevents unnecessary updates)
        if (newContent === lastContentRef.current) return;
        lastContentRef.current = newContent;
        
        // For large content (>50KB), debounce the onChange call
        const isLargeContent = newContent.length > 50000;
        
        if (isLargeContent) {
          // Debounce for large content to prevent UI freeze
          if (debouncedOnChangeRef.current) {
            clearTimeout(debouncedOnChangeRef.current);
          }
          debouncedOnChangeRef.current = setTimeout(() => {
            onChange(newContent);
          }, 300);
        } else {
          // Immediate update for small content
          onChange(newContent);
        }

        // Add to history (but not during composition to avoid flooding)
        // Also limit history size for large content
        if (!isComposingRef.current) {
          const maxHistorySize = isLargeContent ? 10 : 50;
          const newHistory = history.slice(Math.max(0, history.length - maxHistorySize), historyIndex + 1);
          newHistory.push(newContent);
          setHistory(newHistory);
          setHistoryIndex(newHistory.length - 1);
        }
      }
    } catch (error) {
      console.error('Error handling input:', error);
    }
  };

  // Handle keydown for auto-capitalization and auto-calculation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Auto-calculate when = is typed
    if (e.key === '=' && editorRef.current) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const textNode = range.startContainer;
        if (textNode.nodeType === Node.TEXT_NODE) {
          const text = textNode.textContent || '';
          const cursorPos = range.startOffset;
          // Get text before cursor including the = that will be typed
          const textBeforeCursor = text.substring(0, cursorPos);
          
          // Schedule auto-calculation after the = is inserted
          setTimeout(() => {
            if (!editorRef.current) return;
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) return;
            
            const currentRange = sel.getRangeAt(0);
            const currentTextNode = currentRange.startContainer;
            if (currentTextNode.nodeType !== Node.TEXT_NODE) return;
            
            const currentText = currentTextNode.textContent || '';
            const currentPos = currentRange.startOffset;
            const textToCheck = currentText.substring(0, currentPos);
            
            // Try to calculate
            const result = autoCalculate(textToCheck);
            if (result !== null) {
              // Insert the result after the = sign
              const newText = currentText.substring(0, currentPos) + result + currentText.substring(currentPos);
              currentTextNode.textContent = newText;
              
              // Move cursor after the result
              const newRange = document.createRange();
              newRange.setStart(currentTextNode, currentPos + result.length);
              newRange.setEnd(currentTextNode, currentPos + result.length);
              sel.removeAllRanges();
              sel.addRange(newRange);
              
              // Trigger input to save
              handleInput();
            }
          }, 10);
        }
      }
    }
    
    // Auto-capitalize after sentence-ending punctuation followed by space
    if (e.key === ' ' && editorRef.current) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const textNode = range.startContainer;
        if (textNode.nodeType === Node.TEXT_NODE) {
          const text = textNode.textContent || '';
          const cursorPos = range.startOffset;
          // Check if previous char is sentence-ending punctuation
          if (cursorPos > 0 && /[.!?]/.test(text[cursorPos - 1])) {
            // The next character typed should be capitalized - handled by browser autocapitalize
          }
        }
      }
    }
  }, []);

  // Handle composition events for Android/IME input
  const handleCompositionStart = () => {
    isComposingRef.current = true;
  };

  const handleCompositionEnd = () => {
    isComposingRef.current = false;
    // Trigger input after composition ends to capture final content
    handleInput();
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      const previousContent = history[newIndex];
      if (editorRef.current) {
        editorRef.current.innerHTML = sanitizeHtml(previousContent);
        onChange(previousContent);
      }
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      const nextContent = history[newIndex];
      if (editorRef.current) {
        editorRef.current.innerHTML = sanitizeHtml(nextContent);
        onChange(nextContent);
      }
    }
  };

  const handleTextCase = (caseType: 'upper' | 'lower' | 'capitalize') => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      toast.error('Please select text first');
      return;
    }

    const selectedText = selection.toString();
    if (!selectedText) {
      toast.error('Please select text first');
      return;
    }

    let convertedText: string;
    if (caseType === 'upper') {
      convertedText = selectedText.toUpperCase();
    } else if (caseType === 'lower') {
      convertedText = selectedText.toLowerCase();
    } else {
      // Capitalize first letter of each word
      convertedText = selectedText.replace(/\b\w/g, char => char.toUpperCase());
    }

    document.execCommand('insertText', false, convertedText);
    toast.success(
      caseType === 'upper' ? 'Text converted to uppercase' : 
      caseType === 'lower' ? 'Text converted to lowercase' : 
      'First letter of each word capitalized'
    );
  };

  const handleAlignment = (alignment: 'left' | 'center' | 'right' | 'justify') => {
    const commands = {
      left: 'justifyLeft',
      center: 'justifyCenter',
      right: 'justifyRight',
      justify: 'justifyFull',
    };
    execCommand(commands[alignment]);
  };

  const handleInsertTable = (rows: number, cols: number, style?: TableStyle) => {
    if (editorRef.current) {
      editorRef.current.focus();
      
      // Create resizable table wrapper
      const tableHTML = generateTableHTML(rows, cols, style);
      const wrapperHTML = `<div class="resizable-table-wrapper" data-table-width="100" contenteditable="false" style="width: 100%; margin: 16px 0; position: relative;">${tableHTML}</div><p><br></p>`;
      
      document.execCommand('insertHTML', false, wrapperHTML);
      
      // Re-attach table resize listeners
      setTimeout(() => {
        reattachTableListeners();
      }, 50);
      
      handleInput();
      toast.success('Table inserted - click to resize');
    }
  };

  // Re-attach event listeners to table wrappers for resizing
  const reattachTableListeners = useCallback(() => {
    if (!editorRef.current) return;
    
    const wrappers = editorRef.current.querySelectorAll('.resizable-table-wrapper');
    wrappers.forEach((wrapper) => {
      const wrapperEl = wrapper as HTMLElement;
      
      // Skip if already has resize handles
      if (wrapperEl.querySelector('.table-resize-handle')) return;
      
      wrapperEl.contentEditable = 'false';
      wrapperEl.style.position = 'relative';
      
      // Create resize handles
      const leftHandle = document.createElement('div');
      leftHandle.className = 'table-resize-handle table-resize-left';
      leftHandle.style.cssText = `
        position: absolute;
        top: 50%;
        left: -8px;
        transform: translateY(-50%);
        width: 6px;
        height: 40px;
        background: hsl(var(--primary));
        border-radius: 3px;
        cursor: ew-resize;
        opacity: 0;
        transition: opacity 0.2s;
        z-index: 10;
      `;
      
      const rightHandle = document.createElement('div');
      rightHandle.className = 'table-resize-handle table-resize-right';
      rightHandle.style.cssText = `
        position: absolute;
        top: 50%;
        right: -8px;
        transform: translateY(-50%);
        width: 6px;
        height: 40px;
        background: hsl(var(--primary));
        border-radius: 3px;
        cursor: ew-resize;
        opacity: 0;
        transition: opacity 0.2s;
        z-index: 10;
      `;
      
      // Width indicator
      const widthIndicator = document.createElement('div');
      widthIndicator.className = 'table-width-indicator';
      widthIndicator.style.cssText = `
        position: absolute;
        bottom: -24px;
        left: 50%;
        transform: translateX(-50%);
        background: hsl(var(--background));
        border: 1px solid hsl(var(--border));
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 11px;
        opacity: 0;
        transition: opacity 0.2s;
        z-index: 10;
        pointer-events: none;
      `;
      widthIndicator.textContent = `${wrapperEl.getAttribute('data-table-width') || 100}%`;
      
      // Show handles on hover
      wrapperEl.addEventListener('mouseenter', () => {
        leftHandle.style.opacity = '1';
        rightHandle.style.opacity = '1';
        widthIndicator.style.opacity = '1';
      });
      
      wrapperEl.addEventListener('mouseleave', () => {
        if (!wrapperEl.classList.contains('resizing')) {
          leftHandle.style.opacity = '0';
          rightHandle.style.opacity = '0';
          widthIndicator.style.opacity = '0';
        }
      });
      
      // Resize logic
      let isResizing = false;
      let startX = 0;
      let startWidth = 0;
      
      const startResize = (e: MouseEvent | TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();
        isResizing = true;
        wrapperEl.classList.add('resizing');
        
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        startX = clientX;
        startWidth = wrapperEl.offsetWidth;
        
        document.addEventListener('mousemove', onResize);
        document.addEventListener('mouseup', stopResize);
        document.addEventListener('touchmove', onResize);
        document.addEventListener('touchend', stopResize);
      };
      
      const onResize = (e: MouseEvent | TouchEvent) => {
        if (!isResizing) return;
        
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const deltaX = clientX - startX;
        const parentWidth = wrapperEl.parentElement?.clientWidth || 800;
        const newWidthPx = Math.max(200, Math.min(parentWidth, startWidth + deltaX));
        const newWidthPercent = Math.round((newWidthPx / parentWidth) * 100);
        
        wrapperEl.style.width = `${newWidthPercent}%`;
        wrapperEl.setAttribute('data-table-width', String(newWidthPercent));
        widthIndicator.textContent = `${newWidthPercent}%`;
      };
      
      const stopResize = () => {
        if (isResizing) {
          isResizing = false;
          wrapperEl.classList.remove('resizing');
          document.removeEventListener('mousemove', onResize);
          document.removeEventListener('mouseup', stopResize);
          document.removeEventListener('touchmove', onResize);
          document.removeEventListener('touchend', stopResize);
          handleInput();
        }
      };
      
      leftHandle.addEventListener('mousedown', startResize);
      leftHandle.addEventListener('touchstart', startResize);
      rightHandle.addEventListener('mousedown', startResize);
      rightHandle.addEventListener('touchstart', startResize);
      
      wrapperEl.appendChild(leftHandle);
      wrapperEl.appendChild(rightHandle);
      wrapperEl.appendChild(widthIndicator);
    });
  }, [handleInput]);

  // Re-attach event listeners to image wrappers after content loads
  const reattachImageListeners = useCallback(() => {
    if (!editorRef.current) return;
    
    const wrappers = editorRef.current.querySelectorAll('.resizable-image-wrapper');
    wrappers.forEach((wrapper) => {
      const wrapperEl = wrapper as HTMLElement;
      const img = wrapperEl.querySelector('img') as HTMLImageElement;
      const resizeHandle = wrapperEl.querySelector('.image-resize-handle') as HTMLElement;
      let deleteHandle = wrapperEl.querySelector('.image-delete-handle') as HTMLElement;
      let alignToolbar = wrapperEl.querySelector('.image-align-toolbar') as HTMLElement;
      
      if (!img || !resizeHandle) return;

      // Fix wrapper styling for normal flow
      wrapperEl.style.display = 'block';
      wrapperEl.style.position = 'relative';
      wrapperEl.style.width = 'fit-content';
      wrapperEl.style.transform = 'none';
      
      // Apply saved alignment
      const savedAlign = wrapperEl.getAttribute('data-image-align') || 'left';
      if (savedAlign === 'left') {
        wrapperEl.style.marginLeft = '0';
        wrapperEl.style.marginRight = 'auto';
        wrapperEl.style.marginTop = '10px';
        wrapperEl.style.marginBottom = '10px';
      } else if (savedAlign === 'center') {
        wrapperEl.style.marginLeft = 'auto';
        wrapperEl.style.marginRight = 'auto';
        wrapperEl.style.marginTop = '10px';
        wrapperEl.style.marginBottom = '10px';
      } else {
        wrapperEl.style.marginLeft = 'auto';
        wrapperEl.style.marginRight = '0';
        wrapperEl.style.marginTop = '10px';
        wrapperEl.style.marginBottom = '10px';
      }
      
      // Remove old move handle if exists
      const oldMoveHandle = wrapperEl.querySelector('.image-move-handle');
      if (oldMoveHandle) oldMoveHandle.remove();

      // Create delete handle if it doesn't exist (for old saved images)
      if (!deleteHandle) {
        deleteHandle = document.createElement('div');
        deleteHandle.className = 'image-delete-handle';
        deleteHandle.style.position = 'absolute';
        deleteHandle.style.top = '-4px';
        deleteHandle.style.right = '-4px';
        deleteHandle.style.width = '16px';
        deleteHandle.style.height = '16px';
        deleteHandle.style.backgroundColor = 'hsl(var(--destructive))';
        deleteHandle.style.borderRadius = '50%';
        deleteHandle.style.cursor = 'pointer';
        deleteHandle.style.display = 'none';
        deleteHandle.style.zIndex = '10';
        deleteHandle.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
        wrapperEl.appendChild(deleteHandle);
      }

      // Create alignment toolbar if it doesn't exist
      if (!alignToolbar) {
        alignToolbar = document.createElement('div');
        alignToolbar.className = 'image-align-toolbar';
        alignToolbar.style.position = 'absolute';
        alignToolbar.style.bottom = '-32px';
        alignToolbar.style.left = '50%';
        alignToolbar.style.transform = 'translateX(-50%)';
        alignToolbar.style.display = 'none';
        alignToolbar.style.flexDirection = 'row';
        alignToolbar.style.gap = '4px';
        alignToolbar.style.padding = '4px';
        alignToolbar.style.backgroundColor = 'hsl(var(--background))';
        alignToolbar.style.border = '1px solid hsl(var(--border))';
        alignToolbar.style.borderRadius = '6px';
        alignToolbar.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
        alignToolbar.style.zIndex = '20';
        
        const leftIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="3" y1="6" y2="6"/><line x1="15" x2="3" y1="12" y2="12"/><line x1="17" x2="3" y1="18" y2="18"/></svg>';
        const centerIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="3" y1="6" y2="6"/><line x1="17" x2="7" y1="12" y2="12"/><line x1="19" x2="5" y1="18" y2="18"/></svg>';
        const rightIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="3" y1="6" y2="6"/><line x1="21" x2="9" y1="12" y2="12"/><line x1="21" x2="7" y1="18" y2="18"/></svg>';
        
        ['left', 'center', 'right'].forEach((align) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.innerHTML = align === 'left' ? leftIcon : align === 'center' ? centerIcon : rightIcon;
          btn.style.width = '28px';
          btn.style.height = '28px';
          btn.style.display = 'flex';
          btn.style.alignItems = 'center';
          btn.style.justifyContent = 'center';
          btn.style.border = 'none';
          btn.style.borderRadius = '4px';
          btn.style.backgroundColor = 'transparent';
          btn.style.cursor = 'pointer';
          btn.style.color = 'hsl(var(--foreground))';
          alignToolbar.appendChild(btn);
        });
        
        wrapperEl.appendChild(alignToolbar);
      }
      
      // Remove old listeners by cloning elements
      const newWrapper = wrapperEl.cloneNode(true) as HTMLElement;
      wrapperEl.parentNode?.replaceChild(newWrapper, wrapperEl);
      
      const newImg = newWrapper.querySelector('img') as HTMLImageElement;
      const newResizeHandle = newWrapper.querySelector('.image-resize-handle') as HTMLElement;
      const newDeleteHandle = newWrapper.querySelector('.image-delete-handle') as HTMLElement;
      const newAlignToolbar = newWrapper.querySelector('.image-align-toolbar') as HTMLElement;

      // Add alignment button listeners
      if (newAlignToolbar) {
        const buttons = newAlignToolbar.querySelectorAll('button');
        const aligns = ['left', 'center', 'right'];
        buttons.forEach((btn, index) => {
          (btn as HTMLElement).onmouseenter = () => { (btn as HTMLElement).style.backgroundColor = 'hsl(var(--muted))'; };
          (btn as HTMLElement).onmouseleave = () => { (btn as HTMLElement).style.backgroundColor = 'transparent'; };
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const align = aligns[index];
            newWrapper.setAttribute('data-image-align', align);
            if (align === 'left') {
              newWrapper.style.marginLeft = '0';
              newWrapper.style.marginRight = 'auto';
            } else if (align === 'center') {
              newWrapper.style.marginLeft = 'auto';
              newWrapper.style.marginRight = 'auto';
            } else {
              newWrapper.style.marginLeft = 'auto';
              newWrapper.style.marginRight = '0';
            }
            handleInput();
            toast.success(`Image aligned ${align}`);
          });
        });
      }

      // Delete image on click
      if (newDeleteHandle) {
        newDeleteHandle.addEventListener('click', (e) => {
          e.stopPropagation();
          newWrapper.remove();
          handleInput();
          toast.success('Image deleted');
        });
      }
      
      // Show handles on click
      newWrapper.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.resizable-image-wrapper').forEach(w => {
          const handles = w.querySelectorAll('.image-resize-handle, .image-delete-handle, .image-align-toolbar');
          handles.forEach(h => (h as HTMLElement).style.display = 'none');
          (w as HTMLElement).style.outline = 'none';
        });
        newResizeHandle.style.display = 'block';
        if (newDeleteHandle) newDeleteHandle.style.display = 'block';
        if (newAlignToolbar) newAlignToolbar.style.display = 'flex';
        newWrapper.style.outline = '2px solid hsl(var(--primary))';
        newWrapper.style.outlineOffset = '2px';
      });

      // Resize functionality
      let isResizing = false;
      let startX = 0;
      let startWidth = 0;

      const onResizeMove = (e: MouseEvent) => {
        if (!isResizing) return;
        const deltaX = e.clientX - startX;
        const newWidth = Math.max(50, Math.min(800, startWidth + deltaX));
        newImg.style.width = `${newWidth}px`;
        newWrapper.style.width = 'fit-content';
        newWrapper.setAttribute('data-image-width', String(newWidth));
      };

      const onResizeTouchMove = (e: TouchEvent) => {
        if (!isResizing) return;
        const deltaX = e.touches[0].clientX - startX;
        const newWidth = Math.max(50, Math.min(800, startWidth + deltaX));
        newImg.style.width = `${newWidth}px`;
        newWrapper.style.width = 'fit-content';
        newWrapper.setAttribute('data-image-width', String(newWidth));
      };

      const onResizeEnd = () => {
        isResizing = false;
        document.removeEventListener('mousemove', onResizeMove);
        document.removeEventListener('mouseup', onResizeEnd);
        document.removeEventListener('touchmove', onResizeTouchMove);
        document.removeEventListener('touchend', onResizeEnd);
        handleInput();
      };

      newResizeHandle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        isResizing = true;
        startX = e.clientX;
        startWidth = newImg.offsetWidth;
        document.addEventListener('mousemove', onResizeMove);
        document.addEventListener('mouseup', onResizeEnd);
      });

      newResizeHandle.addEventListener('touchstart', (e) => {
        e.stopPropagation();
        isResizing = true;
        startX = e.touches[0].clientX;
        startWidth = newImg.offsetWidth;
        document.addEventListener('touchmove', onResizeTouchMove);
        document.addEventListener('touchend', onResizeEnd);
      });
    });
  }, []);

  // Re-attach event listeners and styling to audio player containers after content loads
  const reattachAudioListeners = useCallback(() => {
    if (!editorRef.current) return;
    
    const audioContainers = editorRef.current.querySelectorAll('.audio-player-container');
    audioContainers.forEach((container) => {
      const containerEl = container as HTMLElement;
      let audioEl = containerEl.querySelector('audio') as HTMLAudioElement | null;
      const dataSrc = containerEl.getAttribute('data-audio-src');
      
      // If audio element is missing or has no source, try to recreate from data attributes
      if (!audioEl && dataSrc) {
        const newAudio = document.createElement('audio');
        newAudio.controls = true;
        newAudio.src = dataSrc;
        newAudio.style.width = '100%';
        newAudio.style.maxWidth = '400px';
        newAudio.style.height = '54px';
        containerEl.appendChild(newAudio);
        audioEl = newAudio;
      }
      
      if (audioEl) {
        // Ensure audio element has proper attributes
        audioEl.controls = true;
        audioEl.style.width = '100%';
        audioEl.style.maxWidth = '400px';
        audioEl.style.height = '54px';
        
        // Restore src from data attribute if missing or empty
        // Check both .src and getAttribute('src') since data URLs behave differently
        const currentSrc = audioEl.src || audioEl.getAttribute('src');
        if (dataSrc && (!currentSrc || currentSrc === '' || currentSrc === window.location.href)) {
          audioEl.src = dataSrc;
        }
      }
      
      // Ensure container styling
      containerEl.style.margin = '12px 0';
      containerEl.style.display = 'block';
      containerEl.style.textAlign = 'center';
      containerEl.style.background = 'rgba(0, 0, 0, 0.05)';
      containerEl.style.borderRadius = '12px';
      containerEl.style.padding = '12px';
      containerEl.contentEditable = 'false';
    });
  }, []);

  // Set content when it changes from external source (not user input)
  // This prevents crashes on Android by avoiding innerHTML manipulation during typing
  useEffect(() => {
    // Skip if the change came from user input or during composition
    if (isUserInputRef.current) {
      isUserInputRef.current = false;
      return;
    }
    
    // Don't update during composition (IME/autocomplete active)
    if (isComposingRef.current) {
      return;
    }
    
    if (editorRef.current && editorRef.current.innerHTML !== content) {
      // Only update if editor is not focused to avoid cursor issues
      const isFocused = document.activeElement === editorRef.current;
      if (!isFocused) {
        editorRef.current.innerHTML = sanitizeHtml(content);
        // Re-attach image, table, and audio listeners after content is loaded
        setTimeout(() => {
          reattachImageListeners();
          reattachTableListeners();
          reattachAudioListeners();
        }, 0);
      } else {
        // Editor is focused, still reattach audio listeners to ensure they display
        setTimeout(() => {
          reattachAudioListeners();
        }, 0);
      }
    }
  }, [content, reattachImageListeners, reattachTableListeners, reattachAudioListeners]);

  // Initial mount - reattach image, table, and audio listeners
  useEffect(() => {
    if (editorRef.current && content) {
      setTimeout(() => {
        reattachImageListeners();
        reattachTableListeners();
        reattachAudioListeners();
      }, 100);
      
      // Also reattach after a longer delay for dynamic content loading
      setTimeout(() => {
        reattachAudioListeners();
      }, 500);
    }
  }, [content, reattachImageListeners, reattachTableListeners, reattachAudioListeners]);

  // Adjust toolbar position when the on-screen keyboard appears using VisualViewport
  useEffect(() => {
    const vv = (window as any).visualViewport as VisualViewport | undefined;
    const setInset = () => {
      if (!vv) return;
      const bottomInset = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
      document.documentElement.style.setProperty('--keyboard-inset', `${bottomInset}px`);
    };
    setInset();
    if (vv) {
      vv.addEventListener('resize', setInset);
      vv.addEventListener('scroll', setInset);
    }
    return () => {
      if (vv) {
        vv.removeEventListener('resize', setInset);
        vv.removeEventListener('scroll', setInset);
      }
    };
  }, []);

  // Handle table context menu (right-click or long-press on table cells)
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const cell = target.closest('td, th') as HTMLTableCellElement | null;
      const table = target.closest('table') as HTMLTableElement | null;
      
      if (cell && table) {
        e.preventDefault();
        const rowIndex = (cell.parentElement as HTMLTableRowElement)?.rowIndex || 0;
        const colIndex = cell.cellIndex || 0;
        
        setTableContextMenu({
          table,
          rowIndex,
          colIndex,
          position: { x: e.clientX, y: e.clientY },
        });
      }
    };

    const handleClick = () => {
      setTableContextMenu(null);
    };

    editor.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('click', handleClick);
    
    return () => {
      editor.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('click', handleClick);
    };
  }, []);

  const isStickyNote = className?.includes('sticky-note-editor');

  const handleHeading = (level: 1 | 2 | 3 | 'p') => {
    if (level === 'p') {
      execCommand('formatBlock', 'p');
    } else {
      execCommand('formatBlock', `h${level}`);
    }
  };

  const handleTextDirection = (dir: 'ltr' | 'rtl') => {
    setTextDirection(dir);
    if (editorRef.current) {
      editorRef.current.style.direction = dir;
      editorRef.current.style.textAlign = dir === 'rtl' ? 'right' : 'left';
    }
  };

  const handleShowLinkInput = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      savedRangeRef.current = selection.getRangeAt(0);
    }
    setShowLinkInput(true);
  };

  const toolbar = (
    <WordToolbar
      onUndo={handleUndo}
      onRedo={handleRedo}
      canUndo={historyIndex > 0}
      canRedo={historyIndex < history.length - 1}
      onBold={handleBold}
      onItalic={handleItalic}
      onUnderline={handleUnderline}
      onStrikethrough={handleStrikethrough}
      onSubscript={handleSubscript}
      onSuperscript={handleSuperscript}
      onClearFormatting={handleClearFormatting}
      onCodeBlock={handleCodeBlock}
      onHorizontalRule={handleHorizontalRule}
      onBlockquote={handleBlockquote}
      onTextColor={handleTextColor}
      onHighlight={handleHighlight}
      onBulletList={handleBulletList}
      onNumberedList={handleNumberedList}
      onImageUpload={() => fileInputRef.current?.click()}
      onTableInsert={(rows: number, cols: number, style?: string) => {
        const tableHTML = generateTableHTML(rows, cols, (style as TableStyle) || 'default');
        document.execCommand('insertHTML', false, tableHTML);
        handleInput();
        toast.success(`${rows}×${cols} ${style || 'default'} table inserted`);
      }}
      onAlignLeft={() => handleAlignment('left')}
      onAlignCenter={() => handleAlignment('center')}
      onAlignRight={() => handleAlignment('right')}
      onAlignJustify={() => handleAlignment('justify')}
      onTextCase={handleTextCase}
      onFontFamily={onFontFamilyChange}
      onFontSize={handleFontSize}
      onHeading={handleHeading}
      currentFontFamily={fontFamily}
      currentFontSize={fontSize?.replace('px', '') || '16'}
      onInsertLink={handleShowLinkInput}
      onInsertNoteLink={onInsertNoteLink}
      zoom={zoom}
      onZoomChange={setZoom}
      isStickyNote={isStickyNote}
      allowImages={allowImages}
      showTable={showTable}
      onTextDirection={handleTextDirection}
      textDirection={textDirection}
      onAttachment={() => attachmentInputRef.current?.click()}
      onEmojiInsert={(emoji) => {
        document.execCommand('insertText', false, emoji);
        handleInput();
      }}
      isBold={activeStates.isBold}
      isItalic={activeStates.isItalic}
      isUnderline={activeStates.isUnderline}
      isStrikethrough={activeStates.isStrikethrough}
      isSubscript={activeStates.isSubscript}
      isSuperscript={activeStates.isSuperscript}
      alignment={activeStates.alignment}
      isBulletList={activeStates.isBulletList}
      isNumberedList={activeStates.isNumberedList}
    />
  );

  return (
    <div className={cn("w-full h-full flex flex-col", isStickyNote && "sticky-note-editor")}>
      <style>
        {`
          .rich-text-editor a {
            color: #3B82F6;
            text-decoration: underline;
          }
          .rich-text-editor ul {
            list-style: disc;
            padding-left: 2rem;
          }
          .rich-text-editor ol {
            list-style: decimal;
            padding-left: 2rem;
          }
          /* Solid black separator/horizontal rule */
          .rich-text-editor hr {
            border: none;
            border-top: 2px solid #000000 !important;
            margin: 16px 0;
          }
          /* MS Word style page break container */
          .rich-text-editor .page-break-container {
            page-break-after: always;
            margin: 32px 0;
            position: relative;
            user-select: none;
          }
          /* Ensure smooth mobile scrolling inside the editor */
          .rich-text-editor__scroll {
            -webkit-overflow-scrolling: touch;
            overscroll-behavior: contain;
            touch-action: pan-y;
          }
          .title-input {
            font-size: 1.5rem;
            font-weight: bold;
            border: none;
            outline: none;
            background: transparent;
            width: 100%;
            padding: 1rem 1rem 0.5rem 1rem;
          }
          .title-input::placeholder {
            color: rgba(0, 0, 0, 0.3);
          }
          /* Sticky note title should be black */
          .sticky-note-editor .title-input {
            color: #000000 !important;
          }
          /* Enhanced audio player styling */
          .audio-player-container {
            background: rgba(0, 0, 0, 0.05);
            border-radius: 12px;
            padding: 12px;
          }
          .audio-player-container audio {
            width: 100%;
            height: 54px;
            border-radius: 8px;
          }
          .audio-player-container audio::-webkit-media-controls-panel {
            background: transparent;
          }
          /* Print styles for page breaks */
          @media print {
            .rich-text-editor .page-break-container {
              page-break-after: always;
              break-after: page;
            }
          }
        `}
      </style>

      {toolbarPosition === 'top' && toolbar}

      {showTitle && onTitleChange && (
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Title"
          className="title-input"
          autoCapitalize="sentences"
          style={{ fontFamily, color: isStickyNote ? '#000000' : undefined }}
        />
      )}

      {/* Hidden file inputs */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleImageUpload}
      />
      <input
        type="file"
        ref={attachmentInputRef}
        className="hidden"
        accept="*/*"
        onChange={handleFileAttachment}
      />

      {/* Link Input Popup */}
      {showLinkInput && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowLinkInput(false)}>
          <div className="bg-background rounded-lg p-4 w-full max-w-sm shadow-lg" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold mb-2">{t('editor.insertLink')}</h3>
            <Input
              placeholder="https://example.com"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLink()}
              autoFocus
            />
            <div className="flex gap-2 mt-3">
              <Button variant="outline" size="sm" onClick={() => setShowLinkInput(false)}>{t('common.cancel')}</Button>
              <Button size="sm" onClick={handleLink}>{t('editor.insert')}</Button>
            </div>
          </div>
        </div>
      )}

      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onKeyDown={handleKeyDown}
        data-gramm="false"
        data-gramm_editor="false"
        data-enable-grammarly="false"
        className={cn(
          "rich-text-editor flex-1 min-h-0 p-4 border-0 focus:outline-none overflow-y-auto pb-32 rich-text-editor__scroll origin-top-left",
          // Don't add pt-2 for lined notes - let CSS padding-top handle it
          showTitle && !className?.includes('lined-note') ? "pt-2" : "",
          className
        )}
        style={{
          paddingBottom: 'calc(8rem + var(--keyboard-inset, 0px))',
          fontFamily,
          fontSize,
          fontWeight,
          letterSpacing,
          // Don't override lineHeight for lined notes - let CSS handle it
          lineHeight: className?.includes('lined-note') ? undefined : lineHeight,
          fontStyle: isItalic ? 'italic' : 'normal',
          textTransform: 'none',
          transform: `scale(${zoom / 100})`,
          transformOrigin: 'top left',
          width: `${10000 / zoom}%`,
          direction: textDirection,
          textAlign: textDirection === 'rtl' ? 'right' : 'left',
        }}
        // @ts-ignore - autocapitalize is valid HTML attribute
        autoCapitalize="sentences"
        suppressContentEditableWarning
      />

      {toolbarPosition === 'bottom' && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t safe-area-bottom"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + var(--keyboard-inset, 0px))' }}
        >
          {toolbar}
        </div>
      )}

      {/* Table Context Menu */}
      {tableContextMenu && (
        <TableContextMenu
          table={tableContextMenu.table}
          rowIndex={tableContextMenu.rowIndex}
          colIndex={tableContextMenu.colIndex}
          position={tableContextMenu.position}
          onClose={() => setTableContextMenu(null)}
          onTableChange={handleInput}
        />
      )}
    </div>
  );
};
