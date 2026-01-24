import { useCallback, useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Subscript,
  Superscript,
  RemoveFormatting,
  Code,
  Minus,
  Quote,
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
  Table,
  Star,
  Paperclip,
  Heading1,
  Heading2,
  Heading3,
  MessageSquare,
  Link2,
  FileText,
  Columns,
  SplitSquareHorizontal,
  Maximize,
  Minimize,
  ZoomIn,
  ZoomOut,
  PilcrowLeft,
  PilcrowRight,
  CaseSensitive,
  CaseUpper,
  CaseLower,
  Plus,
  GripVertical,
} from 'lucide-react';
import { EmojiPicker } from './EmojiPicker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';

interface WordToolbarProps {
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onBold: () => void;
  onItalic: () => void;
  onUnderline: () => void;
  onStrikethrough?: () => void;
  onSubscript?: () => void;
  onSuperscript?: () => void;
  onClearFormatting?: () => void;
  onCodeBlock?: () => void;
  onHorizontalRule?: () => void;
  onBlockquote?: () => void;
  onTextColor: (color: string) => void;
  onHighlight: (color: string) => void;
  onBulletList: () => void;
  onNumberedList: () => void;
  onImageUpload: () => void;
  onTableInsert: (rows: number, cols: number, style?: string) => void;
  onAlignLeft: () => void;
  onAlignCenter: () => void;
  onAlignRight: () => void;
  onAlignJustify: () => void;
  onTextCase: (caseType: 'upper' | 'lower' | 'capitalize') => void;
  onFontFamily?: (font: string) => void;
  onFontSize?: (size: string) => void;
  onGlobalFontSizeChange?: (size: string) => void;
  onHeading: (level: 1 | 2 | 3 | 'p') => void;
  currentFontFamily?: string;
  currentFontSize?: string;
  onInsertLink?: () => void;
  onInsertNoteLink?: () => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  isStickyNote?: boolean;
  allowImages?: boolean;
  showTable?: boolean;
  // Extended features
  onComment?: () => void;
  onTextDirection?: (dir: 'ltr' | 'rtl') => void;
  textDirection?: 'ltr' | 'rtl';
  onAttachment?: () => void;
  onEmojiInsert?: (emoji: string) => void;
  // Active states
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  isStrikethrough?: boolean;
  isSubscript?: boolean;
  isSuperscript?: boolean;
  alignment?: 'left' | 'center' | 'right' | 'justify';
  isBulletList?: boolean;
  isNumberedList?: boolean;
}

// Toolbar item types for reordering
type ToolbarItemId = 
  | 'bold' | 'italic' | 'underline' | 'strikethrough' | 'subscript' | 'superscript' 
  | 'clearFormatting' | 'codeBlock' | 'horizontalRule' | 'blockquote' | 'emoji'
  | 'bulletList' | 'numberedList' | 'image' | 'table' | 'highlight' | 'textColor'
  | 'undo' | 'redo' | 'alignLeft' | 'alignCenter' | 'alignRight' | 'alignJustify'
  | 'fontFamily' | 'fontSize' | 'headings' | 'textCase' | 'ltr' | 'rtl'
  | 'comment' | 'link' | 'noteLink' | 'attachment' | 'zoom';

const TOOLBAR_ORDER_KEY = 'wordToolbarOrder';

const DEFAULT_TOOLBAR_ORDER: ToolbarItemId[] = [
  'bold', 'italic', 'underline', 'fontFamily', 'fontSize', 'strikethrough', 'subscript', 'superscript',
  'clearFormatting', 'codeBlock', 'horizontalRule', 'blockquote', 'emoji',
  'bulletList', 'numberedList', 'image', 'table', 'highlight', 'textColor',
  'undo', 'redo', 'alignLeft', 'alignCenter', 'alignRight', 'alignJustify',
  'headings', 'textCase', 'ltr', 'rtl',
  'comment', 'link', 'noteLink', 'attachment', 'zoom'
];

// Note: Toolbar order is now managed via IndexedDB in ToolbarOrderManager
// This file uses cached order that gets synced from ToolbarOrderManager

let cachedToolbarOrder: ToolbarItemId[] = [...DEFAULT_TOOLBAR_ORDER];

const getToolbarOrder = (): ToolbarItemId[] => {
  return cachedToolbarOrder;
};

const saveToolbarOrder = (order: ToolbarItemId[]) => {
  cachedToolbarOrder = order;
  // Actual persistence handled by ToolbarOrderManager via IndexedDB
};

export const setCachedToolbarOrder = (order: ToolbarItemId[]) => {
  cachedToolbarOrder = order;
};

// 60+ text colors organized by hue
const TEXT_COLORS = [
  // Grays
  { name: 'Black', value: '#000000' },
  { name: 'Dark Gray', value: '#1F2937' },
  { name: 'Gray', value: '#374151' },
  { name: 'Medium Gray', value: '#6B7280' },
  { name: 'Light Gray', value: '#9CA3AF' },
  { name: 'Silver', value: '#D1D5DB' },
  { name: 'White', value: '#FFFFFF' },
  // Reds
  { name: 'Dark Red', value: '#7F1D1D' },
  { name: 'Red', value: '#DC2626' },
  { name: 'Bright Red', value: '#EF4444' },
  { name: 'Light Red', value: '#F87171' },
  { name: 'Rose', value: '#FB7185' },
  { name: 'Coral', value: '#FF6B6B' },
  // Oranges
  { name: 'Burnt Orange', value: '#C2410C' },
  { name: 'Dark Orange', value: '#EA580C' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Light Orange', value: '#FB923C' },
  { name: 'Peach', value: '#FDBA74' },
  { name: 'Apricot', value: '#FED7AA' },
  // Yellows
  { name: 'Dark Yellow', value: '#A16207' },
  { name: 'Gold', value: '#CA8A04' },
  { name: 'Yellow', value: '#EAB308' },
  { name: 'Bright Yellow', value: '#FACC15' },
  { name: 'Light Yellow', value: '#FDE047' },
  { name: 'Lemon', value: '#FEF08A' },
  // Greens
  { name: 'Dark Green', value: '#14532D' },
  { name: 'Forest Green', value: '#166534' },
  { name: 'Green', value: '#16A34A' },
  { name: 'Emerald', value: '#10B981' },
  { name: 'Teal', value: '#14B8A6' },
  { name: 'Light Green', value: '#4ADE80' },
  { name: 'Lime', value: '#84CC16' },
  { name: 'Mint', value: '#86EFAC' },
  // Blues
  { name: 'Navy', value: '#1E3A8A' },
  { name: 'Dark Blue', value: '#1D4ED8' },
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Bright Blue', value: '#60A5FA' },
  { name: 'Sky Blue', value: '#38BDF8' },
  { name: 'Light Blue', value: '#7DD3FC' },
  { name: 'Cyan', value: '#22D3EE' },
  { name: 'Ice Blue', value: '#BAE6FD' },
  // Purples
  { name: 'Dark Purple', value: '#581C87' },
  { name: 'Purple', value: '#7C3AED' },
  { name: 'Violet', value: '#8B5CF6' },
  { name: 'Light Purple', value: '#A78BFA' },
  { name: 'Lavender', value: '#C4B5FD' },
  { name: 'Indigo', value: '#6366F1' },
  // Pinks
  { name: 'Dark Pink', value: '#9D174D' },
  { name: 'Magenta', value: '#DB2777' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Hot Pink', value: '#F472B6' },
  { name: 'Light Pink', value: '#F9A8D4' },
  { name: 'Blush', value: '#FBCFE8' },
  // Browns
  { name: 'Dark Brown', value: '#422006' },
  { name: 'Brown', value: '#78350F' },
  { name: 'Chocolate', value: '#92400E' },
  { name: 'Caramel', value: '#B45309' },
  { name: 'Tan', value: '#D97706' },
  { name: 'Beige', value: '#FDE68A' },
];

// 60+ highlight colors organized by hue
const HIGHLIGHT_COLORS = [
  { name: 'None', value: 'transparent' },
  // Light Yellows
  { name: 'Light Yellow', value: '#FEF08A' },
  { name: 'Pale Yellow', value: '#FEF9C3' },
  { name: 'Cream', value: '#FFFBEB' },
  { name: 'Butter', value: '#FDE68A' },
  { name: 'Gold Highlight', value: '#FCD34D' },
  { name: 'Honey', value: '#FBBF24' },
  // Light Oranges
  { name: 'Light Orange', value: '#FED7AA' },
  { name: 'Peach', value: '#FFEDD5' },
  { name: 'Coral Light', value: '#FED7E2' },
  { name: 'Salmon', value: '#FECACA' },
  { name: 'Apricot', value: '#FDBA74' },
  { name: 'Melon', value: '#FB923C' },
  // Light Reds/Pinks
  { name: 'Light Pink', value: '#FBCFE8' },
  { name: 'Rose', value: '#FECDD3' },
  { name: 'Blush', value: '#FDF2F8' },
  { name: 'Cotton Candy', value: '#F9A8D4' },
  { name: 'Light Red', value: '#FECACA' },
  { name: 'Warm Pink', value: '#FDA4AF' },
  // Light Purples
  { name: 'Light Purple', value: '#E9D5FF' },
  { name: 'Lavender', value: '#F3E8FF' },
  { name: 'Lilac', value: '#DDD6FE' },
  { name: 'Wisteria', value: '#C4B5FD' },
  { name: 'Orchid', value: '#D8B4FE' },
  { name: 'Grape', value: '#A78BFA' },
  // Light Blues
  { name: 'Light Blue', value: '#BFDBFE' },
  { name: 'Sky Blue', value: '#E0F2FE' },
  { name: 'Ice Blue', value: '#F0F9FF' },
  { name: 'Powder Blue', value: '#BAE6FD' },
  { name: 'Azure', value: '#7DD3FC' },
  { name: 'Cyan Light', value: '#CFFAFE' },
  // Light Greens
  { name: 'Light Green', value: '#BBF7D0' },
  { name: 'Mint', value: '#D1FAE5' },
  { name: 'Seafoam', value: '#ECFDF5' },
  { name: 'Sage', value: '#A7F3D0' },
  { name: 'Pistachio', value: '#86EFAC' },
  { name: 'Spring Green', value: '#6EE7B7' },
  // Light Teals
  { name: 'Light Teal', value: '#99F6E4' },
  { name: 'Aqua', value: '#CCFBF1' },
  { name: 'Turquoise', value: '#5EEAD4' },
  { name: 'Sea Glass', value: '#2DD4BF' },
  { name: 'Pool', value: '#A5F3FC' },
  { name: 'Ocean', value: '#67E8F9' },
  // Grays
  { name: 'Light Gray', value: '#E5E7EB' },
  { name: 'Silver', value: '#F3F4F6' },
  { name: 'Platinum', value: '#F9FAFB' },
  { name: 'Smoke', value: '#D1D5DB' },
  { name: 'Ash', value: '#9CA3AF' },
  { name: 'Slate', value: '#CBD5E1' },
  // Earthy Tones
  { name: 'Beige', value: '#FEF3C7' },
  { name: 'Sand', value: '#FDE68A' },
  { name: 'Wheat', value: '#F5DEB3' },
  { name: 'Linen', value: '#FAF0E6' },
  { name: 'Ivory', value: '#FFFFF0' },
  { name: 'Tan Light', value: '#D4A574' },
];

const FONT_FAMILIES = [
  { name: 'Default', value: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  { name: 'Arial', value: 'Arial, sans-serif' },
  { name: 'Times New Roman', value: '"Times New Roman", serif' },
  { name: 'Georgia', value: 'Georgia, serif' },
  { name: 'Courier New', value: '"Courier New", monospace' },
  { name: 'Verdana', value: 'Verdana, sans-serif' },
  { name: 'Roboto', value: '"Roboto", sans-serif' },
  { name: 'Open Sans', value: '"Open Sans", sans-serif' },
  // Handwriting Style Fonts
  { name: 'Dancing Script', value: '"Dancing Script", cursive' },
  { name: 'Pacifico', value: '"Pacifico", cursive' },
  { name: 'Indie Flower', value: '"Indie Flower", cursive' },
  { name: 'Shadows Into Light', value: '"Shadows Into Light", cursive' },
  { name: 'Permanent Marker', value: '"Permanent Marker", cursive' },
  { name: 'Caveat', value: '"Caveat", cursive' },
  { name: 'Satisfy', value: '"Satisfy", cursive' },
  { name: 'Kalam', value: '"Kalam", cursive' },
  { name: 'Patrick Hand', value: '"Patrick Hand", cursive' },
  { name: 'Architects Daughter', value: '"Architects Daughter", cursive' },
  { name: 'Amatic SC', value: '"Amatic SC", cursive' },
  { name: 'Gloria Hallelujah', value: '"Gloria Hallelujah", cursive' },
  { name: 'Handlee', value: '"Handlee", cursive' },
  { name: 'Nothing You Could Do', value: '"Nothing You Could Do", cursive' },
  { name: 'Rock Salt', value: '"Rock Salt", cursive' },
  { name: 'Homemade Apple', value: '"Homemade Apple", cursive' },
  { name: 'La Belle Aurore', value: '"La Belle Aurore", cursive' },
  { name: 'Sacramento', value: '"Sacramento", cursive' },
  { name: 'Great Vibes', value: '"Great Vibes", cursive' },
  { name: 'Allura', value: '"Allura", cursive' },
  { name: 'Alex Brush', value: '"Alex Brush", cursive' },
  { name: 'Tangerine', value: '"Tangerine", cursive' },
  { name: 'Yellowtail', value: '"Yellowtail", cursive' },
  { name: 'Marck Script', value: '"Marck Script", cursive' },
  { name: 'Courgette', value: '"Courgette", cursive' },
  { name: 'Cookie', value: '"Cookie", cursive' },
];

export const WordToolbar = ({
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onBold,
  onItalic,
  onUnderline,
  onStrikethrough,
  onSubscript,
  onSuperscript,
  onClearFormatting,
  onCodeBlock,
  onHorizontalRule,
  onBlockquote,
  onTextColor,
  onHighlight,
  onBulletList,
  onNumberedList,
  onImageUpload,
  onTableInsert,
  onAlignLeft,
  onAlignCenter,
  onAlignRight,
  onAlignJustify,
  onTextCase,
  onFontFamily,
  onFontSize,
  onHeading,
  currentFontFamily,
  currentFontSize = '16',
  onInsertLink,
  onInsertNoteLink,
  zoom,
  onZoomChange,
  isStickyNote = false,
  allowImages = true,
  showTable = true,
  onComment,
  onTextDirection,
  textDirection = 'ltr',
  onAttachment,
  onEmojiInsert,
  isBold = false,
  isItalic = false,
  isUnderline = false,
  isStrikethrough = false,
  isSubscript = false,
  isSuperscript = false,
  alignment = 'left',
  isBulletList = false,
  isNumberedList = false,
}: WordToolbarProps) => {
  const [fontPickerOpen, setFontPickerOpen] = useState(false);
  const [fontSizePickerOpen, setFontSizePickerOpen] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [tablePickerOpen, setTablePickerOpen] = useState(false);
  const [tableStyle, setTableStyle] = useState<'default' | 'striped' | 'bordered' | 'minimal' | 'modern'>('default');

  const FONT_SIZES = [
    '8', '9', '10', '11', '12', '14', '16', '18', '20', '24', '28', '32', '36', '48', '72'
  ];

  const TABLE_STYLE_OPTIONS = [
    { id: 'default', name: 'Default' },
    { id: 'striped', name: 'Striped' },
    { id: 'bordered', name: 'Bordered' },
    { id: 'minimal', name: 'Minimal' },
    { id: 'modern', name: 'Modern' },
  ] as const;

  const ToolbarButton = ({ 
    onClick, 
    disabled, 
    title, 
    children,
    className = '',
    colorIndicator,
    isActive = false,
  }: { 
    onClick?: () => void; 
    disabled?: boolean; 
    title: string; 
    children: React.ReactNode;
    className?: string;
    colorIndicator?: string;
    isActive?: boolean;
  }) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-14 min-w-[52px] p-0 flex flex-col items-center justify-center gap-1 rounded-none hover:bg-muted/60 active:bg-muted transition-colors flex-shrink-0",
        disabled && "opacity-40",
        isActive && "bg-primary/10 text-primary",
        className
      )}
      title={title}
    >
      {children}
      {colorIndicator && (
        <div 
          className="h-1 w-7 rounded-sm" 
          style={{ backgroundColor: colorIndicator }}
        />
      )}
    </Button>
  );

  const ToolbarSeparator = () => (
    <div className="w-px h-7 bg-border/30 mx-2" />
  );

  return (
    <div className={cn(
      "border-t border-border/50",
      isStickyNote ? "bg-white" : "bg-muted/30"
    )}>
      {/* Single Line Toolbar with Horizontal Scroll - Matching reference design */}
      <div className="flex items-center gap-0 px-1 overflow-x-auto scrollbar-hide whitespace-nowrap h-14">
        {/* Basic Formatting - B I U */}
        <ToolbarButton onClick={onBold} title="Bold (Ctrl+B)" isActive={isBold}>
          <span className="text-xl font-black">B</span>
        </ToolbarButton>
        <ToolbarButton onClick={onItalic} title="Italic (Ctrl+I)" isActive={isItalic}>
          <span className="text-xl italic font-medium">I</span>
        </ToolbarButton>
        <ToolbarButton onClick={onUnderline} title="Underline (Ctrl+U)" isActive={isUnderline}>
          <span className="text-xl underline font-medium">U</span>
        </ToolbarButton>

        {/* Font Family (T) - moved to position 4 */}
        {onFontFamily && (
          <Popover open={fontPickerOpen} onOpenChange={setFontPickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-14 min-w-[52px] p-0 flex flex-col items-center justify-center gap-1 rounded-none hover:bg-muted/60 active:bg-muted transition-colors flex-shrink-0" title="Font">
                <Type className="h-8 w-8 stroke-[2.5] text-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-1 max-h-[300px] overflow-y-auto">
              {FONT_FAMILIES.map((font) => (
                <Button
                  key={font.value}
                  variant={currentFontFamily === font.value ? "secondary" : "ghost"}
                  size="sm"
                  className="w-full justify-start"
                  style={{ fontFamily: font.value }}
                  onClick={() => {
                    onFontFamily(font.value);
                    setFontPickerOpen(false);
                  }}
                >
                  {font.name}
                </Button>
              ))}
            </PopoverContent>
          </Popover>
        )}

        {/* Font Size (16px) - moved to position 5 */}
        {onFontSize && (
          <Popover open={fontSizePickerOpen} onOpenChange={setFontSizePickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-14 min-w-[52px] p-0 flex flex-col items-center justify-center gap-1 rounded-none hover:bg-muted/60 active:bg-muted transition-colors flex-shrink-0" title="Font Size">
                <span className="text-base font-bold">{currentFontSize}px</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-24 p-1 max-h-[200px] overflow-y-auto">
              {FONT_SIZES.map((size) => (
                <Button
                  key={size}
                  variant={currentFontSize === size ? "secondary" : "ghost"}
                  size="sm"
                  className="w-full justify-center"
                  onClick={() => {
                    onFontSize(size);
                    setFontSizePickerOpen(false);
                  }}
                >
                  {size}
                </Button>
              ))}
            </PopoverContent>
          </Popover>
        )}

        {/* Highlight with color indicator - moved right after font size */}
        <Popover>
          <PopoverTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-14 min-w-[52px] p-0 flex flex-col items-center justify-center gap-1 rounded-none hover:bg-muted/60 active:bg-muted transition-colors flex-shrink-0" 
              title="Highlight"
            >
              <Highlighter className="h-8 w-8 stroke-[2.5] text-foreground" />
              <div className="h-1 w-8 rounded-sm bg-amber-300" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-2 max-h-[300px] overflow-y-auto">
            <p className="text-xs text-muted-foreground mb-2">Highlight Colors</p>
            <div className="grid grid-cols-8 gap-1">
              {HIGHLIGHT_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => onHighlight(color.value)}
                  className="h-7 w-7 rounded-md border border-border hover:scale-110 transition-transform shadow-sm"
                  style={{ backgroundColor: color.value === 'transparent' ? 'white' : color.value }}
                  title={color.name}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Attachment - moved right after highlight */}
        {onAttachment && (
          <ToolbarButton onClick={onAttachment} title="Attach File">
            <Paperclip className="h-8 w-8 stroke-[2.5] text-foreground" />
          </ToolbarButton>
        )}

        {/* Text formatting options continue */}
        {onStrikethrough && (
          <ToolbarButton onClick={onStrikethrough} title="Strikethrough" isActive={isStrikethrough}>
            <Strikethrough className="h-8 w-8 stroke-[2.5] text-foreground" />
          </ToolbarButton>
        )}
        {onSubscript && (
          <ToolbarButton onClick={onSubscript} title="Subscript" isActive={isSubscript}>
            <Subscript className="h-8 w-8 stroke-[2.5] text-foreground" />
          </ToolbarButton>
        )}
        {onSuperscript && (
          <ToolbarButton onClick={onSuperscript} title="Superscript" isActive={isSuperscript}>
            <Superscript className="h-8 w-8 stroke-[2.5] text-foreground" />
          </ToolbarButton>
        )}
        {onClearFormatting && (
          <ToolbarButton onClick={onClearFormatting} title="Clear Formatting">
            <RemoveFormatting className="h-8 w-8 stroke-[2.5] text-foreground" />
          </ToolbarButton>
        )}
        {onHorizontalRule && (
          <ToolbarButton onClick={onHorizontalRule} title="Insert Horizontal Rule">
            <Minus className="h-8 w-8 stroke-[2.5] text-foreground" />
          </ToolbarButton>
        )}
        {/* Comment - moved near formatting */}
        {onComment && (
          <ToolbarButton onClick={onComment} title="Add Comment">
            <MessageSquare className="h-8 w-8 stroke-[2.5] text-foreground" />
          </ToolbarButton>
        )}

        {/* Emoji picker */}
        {onEmojiInsert && (
          <EmojiPicker onEmojiSelect={onEmojiInsert} />
        )}

        {/* Lists - no separator, equal spacing */}
        <ToolbarButton onClick={onBulletList} title="Bullet List" isActive={isBulletList}>
          <List className="h-8 w-8 stroke-[2.5] text-foreground" />
        </ToolbarButton>
        <ToolbarButton onClick={onNumberedList} title="Numbered List" isActive={isNumberedList}>
          <ListOrdered className="h-8 w-8 stroke-[2.5] text-foreground" />
        </ToolbarButton>

        {/* Image - no separator, equal spacing */}
        {allowImages && (
          <ToolbarButton onClick={onImageUpload} title="Insert Image">
            <ImageIcon className="h-8 w-8 stroke-[2.5] text-foreground" />
          </ToolbarButton>
        )}

        {/* Table */}
        {showTable && (
          <Popover open={tablePickerOpen} onOpenChange={setTablePickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-14 min-w-[52px] p-0 flex-shrink-0 rounded-none hover:bg-muted/60" title="Insert Table">
                <Table className="h-8 w-8 stroke-[2.5] text-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-4" align="start">
              <div className="space-y-4">
                <div className="font-medium text-sm">Insert Table</div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Rows</span>
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8"
                        onClick={() => setTableRows(Math.max(1, tableRows - 1))}
                      >
                        <Minus className="h-4 w-4 stroke-[3]" />
                      </Button>
                      <span className="w-8 text-center text-sm font-bold">{tableRows}</span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8"
                        onClick={() => setTableRows(Math.min(20, tableRows + 1))}
                      >
                        <Plus className="h-4 w-4 stroke-[3]" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Columns</span>
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8"
                        onClick={() => setTableCols(Math.max(1, tableCols - 1))}
                      >
                        <Minus className="h-4 w-4 stroke-[3]" />
                      </Button>
                      <span className="w-8 text-center text-sm font-bold">{tableCols}</span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8"
                        onClick={() => setTableCols(Math.min(10, tableCols + 1))}
                      >
                        <Plus className="h-4 w-4 stroke-[3]" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Style Selection */}
                <div className="space-y-2">
                  <span className="text-sm">Style</span>
                  <div className="grid grid-cols-2 gap-1">
                    {TABLE_STYLE_OPTIONS.map((style) => (
                      <Button
                        key={style.id}
                        variant={tableStyle === style.id ? "secondary" : "ghost"}
                        size="sm"
                        className={cn(
                          "h-8 text-xs justify-start",
                          tableStyle === style.id && "ring-1 ring-primary"
                        )}
                        onClick={() => setTableStyle(style.id)}
                      >
                        {style.name}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Grid preview */}
                <div className="border rounded p-2 bg-muted/30">
                  <div 
                    className="grid gap-0.5"
                    style={{ 
                      gridTemplateColumns: `repeat(${Math.min(tableCols, 6)}, 1fr)`,
                    }}
                  >
                    {Array.from({ length: Math.min(tableRows, 5) * Math.min(tableCols, 6) }).map((_, i) => (
                      <div
                        key={i}
                        className="aspect-square bg-primary/20 rounded-sm min-w-[12px]"
                      />
                    ))}
                  </div>
                  {(tableRows > 5 || tableCols > 6) && (
                    <p className="text-xs text-muted-foreground mt-1 text-center">
                      {tableRows}×{tableCols} table
                    </p>
                  )}
                </div>

                <Button 
                  onClick={() => {
                    onTableInsert(tableRows, tableCols, tableStyle);
                    setTablePickerOpen(false);
                  }} 
                  className="w-full" 
                  size="sm"
                >
                  Insert {tableStyle.charAt(0).toUpperCase() + tableStyle.slice(1)} Table
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        )}

        <ToolbarSeparator />

        {/* Text Color with color indicator */}
        <Popover>
          <PopoverTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-14 min-w-[52px] p-0 flex flex-col items-center justify-center gap-1 rounded-none hover:bg-muted/60 active:bg-muted transition-colors flex-shrink-0" 
              title="Text Color"
            >
              <span className="text-xl font-bold">A</span>
              <div className="h-1 w-7 rounded-sm bg-red-500" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-2 max-h-[300px] overflow-y-auto">
            <p className="text-xs text-muted-foreground mb-2">Text Colors</p>
            <div className="grid grid-cols-8 gap-1">
              {TEXT_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => onTextColor(color.value)}
                  className="h-7 w-7 rounded-md border border-border hover:scale-110 transition-transform shadow-sm"
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <ToolbarSeparator />

        {/* Undo/Redo - moved after table */}
        <ToolbarButton onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          <Undo className="h-8 w-8 stroke-[2.5] text-foreground" />
        </ToolbarButton>
        <ToolbarButton onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)">
          <Redo className="h-8 w-8 stroke-[2.5] text-foreground" />
        </ToolbarButton>

        <ToolbarSeparator />

        {/* Alignment */}
        <ToolbarButton onClick={onAlignLeft} title="Align Left" isActive={alignment === 'left'}>
          <AlignLeft className="h-8 w-8 stroke-[2.5] text-foreground" />
        </ToolbarButton>
        <ToolbarButton onClick={onAlignCenter} title="Align Center" isActive={alignment === 'center'}>
          <AlignCenter className="h-8 w-8 stroke-[2.5] text-foreground" />
        </ToolbarButton>
        <ToolbarButton onClick={onAlignRight} title="Align Right" isActive={alignment === 'right'}>
          <AlignRight className="h-8 w-8 stroke-[2.5] text-foreground" />
        </ToolbarButton>
        <ToolbarButton onClick={onAlignJustify} title="Justify" isActive={alignment === 'justify'}>
          <AlignJustify className="h-8 w-8 stroke-[2.5] text-foreground" />
        </ToolbarButton>


        {/* Headings */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-14 min-w-[52px] p-0 flex-shrink-0 rounded-none hover:bg-muted/60" title="Headings">
              <Heading1 className="h-8 w-8 stroke-[2.5] text-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-32 p-1">
            <Button variant="ghost" size="sm" className="w-full justify-start text-lg font-bold" onClick={() => onHeading(1)}>
              Heading 1
            </Button>
            <Button variant="ghost" size="sm" className="w-full justify-start text-base font-bold" onClick={() => onHeading(2)}>
              Heading 2
            </Button>
            <Button variant="ghost" size="sm" className="w-full justify-start text-sm font-bold" onClick={() => onHeading(3)}>
              Heading 3
            </Button>
            <Button variant="ghost" size="sm" className="w-full justify-start text-sm" onClick={() => onHeading('p')}>
              Normal
            </Button>
          </PopoverContent>
        </Popover>

        {/* Text Case */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-14 min-w-[52px] p-0 flex-shrink-0 rounded-none hover:bg-muted/60" title="Change Case">
              <CaseSensitive className="h-8 w-8 stroke-[2.5] text-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-40 p-1">
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full justify-start gap-2" 
              onClick={() => onTextCase('upper')}
            >
              <CaseUpper className="h-5 w-5" />
              UPPERCASE
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full justify-start gap-2"
              onClick={() => onTextCase('lower')}
            >
              <CaseLower className="h-5 w-5" />
              lowercase
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full justify-start gap-2"
              onClick={() => onTextCase('capitalize')}
            >
              <Type className="h-5 w-5" />
              Capitalize Words
            </Button>
          </PopoverContent>
        </Popover>

        <ToolbarSeparator />

        {/* Text Direction */}
        {onTextDirection && (
          <>
            <ToolbarButton 
              onClick={() => onTextDirection('ltr')} 
              title="Left to Right"
              isActive={textDirection === 'ltr'}
            >
              <PilcrowLeft className="h-8 w-8 stroke-[2.5] text-foreground" />
            </ToolbarButton>
            <ToolbarButton 
              onClick={() => onTextDirection('rtl')} 
              title="Right to Left"
              isActive={textDirection === 'rtl'}
            >
              <PilcrowRight className="h-8 w-8 stroke-[2.5] text-foreground" />
            </ToolbarButton>
            <ToolbarSeparator />
          </>
        )}


        {/* Link */}
        {onInsertLink && (
          <ToolbarButton onClick={onInsertLink} title="Insert Link">
            <LinkIcon className="h-8 w-8 stroke-[2.5] text-foreground" />
          </ToolbarButton>
        )}

        {/* Note Link */}
        {onInsertNoteLink && (
          <ToolbarButton onClick={onInsertNoteLink} title="Link to Note">
            <Link2 className="h-8 w-8 stroke-[2.5] text-foreground" />
          </ToolbarButton>
        )}


        <ToolbarSeparator />

        {/* Zoom Controls */}
        <div className="flex items-center gap-0 flex-shrink-0">
          <ToolbarButton 
            onClick={() => onZoomChange(Math.max(50, zoom - 10))} 
            title="Zoom Out"
            disabled={zoom <= 50}
          >
            <ZoomOut className="h-8 w-8 stroke-[2.5] text-foreground" />
          </ToolbarButton>
          
          <div className="w-16 mx-1">
            <Slider
              value={[zoom]}
              min={50}
              max={200}
              step={10}
              onValueChange={(val) => onZoomChange(val[0])}
              className="w-full"
            />
          </div>
          
          <span className="text-xs text-muted-foreground w-10 text-center font-medium">
            {zoom}%
          </span>
          
          <ToolbarButton 
            onClick={() => onZoomChange(Math.min(200, zoom + 10))} 
            title="Zoom In"
            disabled={zoom >= 200}
          >
            <ZoomIn className="h-8 w-8 stroke-[2.5] text-foreground" />
          </ToolbarButton>
        </div>
      </div>
    </div>
  );
};
