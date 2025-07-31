'use client';

import { useTranslation } from '../../hooks/useTranslation';
import { LanguageSelector } from './language-selector';

export const I18nTest = () => {
  const { t, currentLocale } = useTranslation();

  return (
    <div className="p-6 bg-white rounded-lg shadow-md max-w-md mx-auto mt-8">
      <h2 className="text-2xl font-bold mb-4 text-center">
        {t('welcome')}
      </h2>
      
      <div className="space-y-4">
        <div className="text-center">
          <p className="text-lg mb-2">{t('test')}</p>
          <p className="text-sm text-gray-600">
            Current locale: <strong>{currentLocale}</strong>
          </p>
        </div>
        
        <div className="border-t pt-4">
          <LanguageSelector />
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <strong>{t('home')}</strong>: {t('home')}
          </div>
          <div>
            <strong>{t('dashboard')}</strong>: {t('dashboard')}
          </div>
          <div>
            <strong>{t('news')}</strong>: {t('news')}
          </div>
          <div>
            <strong>{t('portfolio')}</strong>: {t('portfolio')}
          </div>
        </div>
      </div>
    </div>
  );
}; 