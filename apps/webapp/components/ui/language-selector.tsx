'use client';

import { useTranslation } from '../../hooks/useTranslation';
import { Button } from './button';

export const LanguageSelector = () => {
  const { t, changeLanguage, currentLocale } = useTranslation();

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-600">{t('language')}:</span>
      <div className="flex gap-1">
        <Button
          variant={currentLocale === 'en' ? 'default' : 'outline'}
          size="sm"
          onClick={() => changeLanguage('en')}
          className="text-xs"
        >
          {t('english')}
        </Button>
        <Button
          variant={currentLocale === 'fr' ? 'default' : 'outline'}
          size="sm"
          onClick={() => changeLanguage('fr')}
          className="text-xs"
        >
          {t('french')}
        </Button>
      </div>
    </div>
  );
}; 