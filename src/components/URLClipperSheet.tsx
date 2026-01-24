import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Note } from '@/types/note';
import { Link2, Loader2, Globe, FileText, ExternalLink, Clipboard } from 'lucide-react';
import { z } from 'zod';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';

interface URLClipperSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (note: Note) => void;
}

const urlSchema = z.string().url({ message: 'Please enter a valid URL' }).max(2048, { message: 'URL is too long' });

const URLClipperSheet = ({ isOpen, onClose, onSave }: URLClipperSheetProps) => {
  // Hardware back button support - use 'sheet' priority to close sheet before navigation
  useHardwareBackButton({
    onBack: onClose,
    enabled: isOpen,
    priority: 'sheet',
  });

  const { toast } = useToast();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchedData, setFetchedData] = useState<{
    title: string;
    description: string;
    content: string;
    image?: string;
  } | null>(null);
  const [editableTitle, setEditableTitle] = useState('');
  const [editableContent, setEditableContent] = useState('');
  const [error, setError] = useState('');

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text);
      setError('');
    } catch (err) {
      toast({
        title: 'Clipboard access denied',
        description: 'Please paste the URL manually.',
        variant: 'destructive',
      });
    }
  };

  const fetchPageContent = async () => {
    setError('');
    
    // Validate URL
    const validation = urlSchema.safeParse(url.trim());
    if (!validation.success) {
      setError(validation.error.errors[0].message);
      return;
    }

    setLoading(true);
    setFetchedData(null);

    try {
      // Format URL
      let formattedUrl = url.trim();
      if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
        formattedUrl = `https://${formattedUrl}`;
      }

      // Use AllOrigins proxy to bypass CORS
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(formattedUrl)}`;
      
      const response = await fetch(proxyUrl);
      
      if (!response.ok) {
        throw new Error('Failed to fetch page');
      }

      const data = await response.json();
      const html = data.contents;

      // Parse HTML to extract metadata
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Extract title
      const title = 
        doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
        doc.querySelector('title')?.textContent ||
        'Untitled Page';

      // Extract description
      const description = 
        doc.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
        doc.querySelector('meta[name="description"]')?.getAttribute('content') ||
        '';

      // Extract main image
      const image = 
        doc.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
        '';

      // Extract main content (simplified - gets text from body)
      const bodyText = doc.body?.textContent?.trim() || '';
      // Clean up whitespace and limit length
      const cleanedText = bodyText
        .replace(/\s+/g, ' ')
        .substring(0, 5000);

      const extractedData = {
        title: title.substring(0, 200),
        description: description.substring(0, 500),
        content: cleanedText,
        image: image || undefined,
      };

      setFetchedData(extractedData);
      setEditableTitle(extractedData.title);
      setEditableContent(
        `**Source:** [${formattedUrl}](${formattedUrl})\n\n` +
        (extractedData.description ? `> ${extractedData.description}\n\n` : '') +
        `---\n\n${extractedData.content.substring(0, 2000)}${extractedData.content.length > 2000 ? '...' : ''}`
      );

      toast({
        title: 'Page fetched!',
        description: 'Review and edit the content before saving.',
      });
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Failed to fetch page content. The website may be blocking access.');
      toast({
        title: 'Fetch failed',
        description: 'Could not retrieve page content. Try a different URL.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAsNote = () => {
    if (!editableTitle.trim()) {
      setError('Please enter a title');
      return;
    }

    const newNote: Note = {
      id: crypto.randomUUID(),
      type: 'regular',
      title: editableTitle.trim().substring(0, 200),
      content: editableContent.substring(0, 50000),
      voiceRecordings: [],
      images: fetchedData?.image ? [fetchedData.image] : undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    onSave(newNote);
    
    toast({
      title: 'Note saved!',
      description: `"${newNote.title}" has been added to your notes.`,
    });

    // Reset and close
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setUrl('');
    setFetchedData(null);
    setEditableTitle('');
    setEditableContent('');
    setError('');
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="h-[90vh] rounded-t-xl">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Clip from URL
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 overflow-y-auto max-h-[calc(90vh-100px)] pb-4">
          {/* URL Input */}
          <div className="space-y-2">
            <Label>Website URL</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="https://example.com/article"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setError('');
                  }}
                  className="pl-10"
                  maxLength={2048}
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={handlePasteFromClipboard}
                title="Paste from clipboard"
              >
                <Clipboard className="h-4 w-4" />
              </Button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          {/* Fetch Button */}
          <Button 
            onClick={fetchPageContent} 
            disabled={!url.trim() || loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Fetching page...
              </>
            ) : (
              <>
                <Globe className="h-4 w-4 mr-2" />
                Fetch Page Content
              </>
            )}
          </Button>

          {/* Fetched Content Preview & Edit */}
          {fetchedData && (
            <div className="space-y-4 pt-4 border-t">
              {/* Preview Card */}
              {fetchedData.image && (
                <div className="rounded-lg overflow-hidden border">
                  <img 
                    src={fetchedData.image} 
                    alt="Page preview" 
                    className="w-full h-32 object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}

              {/* Editable Title */}
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={editableTitle}
                  onChange={(e) => setEditableTitle(e.target.value)}
                  placeholder="Note title"
                  maxLength={200}
                />
              </div>

              {/* Editable Content */}
              <div className="space-y-2">
                <Label>Content</Label>
                <Textarea
                  value={editableContent}
                  onChange={(e) => setEditableContent(e.target.value)}
                  placeholder="Note content"
                  className="min-h-[200px] font-mono text-sm"
                  maxLength={50000}
                />
                <p className="text-xs text-muted-foreground">
                  {editableContent.length.toLocaleString()} / 50,000 characters
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleReset} className="flex-1">
                  Clear
                </Button>
                <Button onClick={handleSaveAsNote} className="flex-1">
                  <FileText className="h-4 w-4 mr-2" />
                  Save as Note
                </Button>
              </div>
            </div>
          )}

          {/* Tips */}
          {!fetchedData && !loading && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium">Tips:</p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>Paste any webpage URL to save its content</li>
                <li>Works best with articles and blog posts</li>
                <li>You can edit the title and content before saving</li>
                <li>Some websites may block content fetching</li>
              </ul>
              
              {/* Privacy Notice */}
              <div className="mt-3 pt-3 border-t border-muted">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">Privacy Notice:</span> This feature uses a third-party proxy service to fetch webpage content. 
                  The URLs you clip may be visible to this service. Do not use for sensitive or private URLs.
                </p>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default URLClipperSheet;
