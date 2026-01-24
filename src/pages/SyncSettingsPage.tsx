import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import SyncSettings from '@/components/SyncSettings';

const SyncSettingsPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen min-h-screen-dynamic bg-background">
      <header className="border-b sticky top-0 bg-card z-10">
        <div className="container mx-auto px-2 xs:px-3 sm:px-4 py-2 xs:py-3 sm:py-4">
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate(-1)}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-base xs:text-lg sm:text-xl font-bold">{t('sync.integrationsImport')}</h1>
          </div>
        </div>
      </header>
      
      <main className="pb-8">
        <SyncSettings />
      </main>
    </div>
  );
};

export default SyncSettingsPage;
