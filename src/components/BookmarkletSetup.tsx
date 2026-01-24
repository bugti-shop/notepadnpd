import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Scissors, Copy, Check, Info, GripVertical } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const BookmarkletSetup = () => {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  // Get the current app URL (works for both dev and production)
  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';

  // Bookmarklet code - clips page title, URL, and selected text
  const bookmarkletCode = `javascript:(function(){
    var title = encodeURIComponent(document.title);
    var url = encodeURIComponent(window.location.href);
    var selection = encodeURIComponent(window.getSelection().toString().trim());
    var meta = document.querySelector('meta[name="description"]');
    var content = meta ? encodeURIComponent(meta.content) : '';
    var clipperUrl = '${appUrl}/clip?title=' + title + '&url=' + url + '&selection=' + selection + '&content=' + content;
    window.open(clipperUrl, '_blank', 'width=450,height=500');
  })();`.replace(/\s+/g, ' ').trim();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bookmarkletCode);
      setCopied(true);
      toast({
        title: t('toasts.bookmarkletCopied'),
        description: t('toasts.bookmarkletCopiedDesc'),
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: t('toasts.copyFailed'),
        description: t('toasts.manualCopyDesc'),
        variant: 'destructive',
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scissors className="h-5 w-5" />
          {t('bookmarklet.title')}
        </CardTitle>
        <CardDescription>
          {t('bookmarklet.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Bookmarklet drag button */}
        <div className="space-y-2">
          <p className="text-sm font-medium">{t('bookmarklet.dragOption')}</p>
          <a
            href={bookmarkletCode}
            onClick={(e) => e.preventDefault()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium cursor-grab active:cursor-grabbing shadow-[0_4px_0_0_hsl(var(--primary)/0.7)] hover:shadow-[0_2px_0_0_hsl(var(--primary)/0.7)] hover:translate-y-[2px] transition-all"
            draggable="true"
          >
            <GripVertical className="h-4 w-4" />
            {t('bookmarklet.clipToNpd')}
          </a>
          <p className="text-xs text-muted-foreground">
            {t('bookmarklet.dragInstructions')}
          </p>
        </div>

        {/* Manual copy option */}
        <div className="space-y-2">
          <p className="text-sm font-medium">{t('bookmarklet.manualOption')}</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="flex items-center gap-2"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  {t('toasts.bookmarkletCopied')}
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  {t('bookmarklet.copyCode')}
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('bookmarklet.pasteInstructions')}
          </p>
        </div>

        {/* Instructions */}
        <div className="bg-muted/50 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">{t('bookmarklet.howToUse')}</p>
          </div>
          <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
            <li>{t('bookmarklet.step1')}</li>
            <li>{t('bookmarklet.step2')}</li>
            <li>{t('bookmarklet.step3')}</li>
            <li>{t('bookmarklet.step4')}</li>
          </ol>
        </div>

        {/* Features */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{t('bookmarklet.pageTitle')}</Badge>
          <Badge variant="secondary">{t('bookmarklet.urlSource')}</Badge>
          <Badge variant="secondary">{t('bookmarklet.selectedTextBadge')}</Badge>
          <Badge variant="secondary">{t('bookmarklet.metaDescription')}</Badge>
        </div>
      </CardContent>
    </Card>
  );
};

export default BookmarkletSetup;
