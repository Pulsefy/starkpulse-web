'use client';

import { useParams, useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { logMissingTranslation } from '@/lib/translation-validator';

// Cache for translations
const translationCache = new Map<string, any>();

// Lazy loading queue
const loadingQueue = new Map<string, Promise<any>>();

// Helper function to get nested value from object using dot notation
const getNestedValue = (obj: any, path: string): any => {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
};

export const useTranslation = (namespace?: string) => {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const [translations, setTranslations] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const locale = params?.locale as string || 'en';
  const translationFile = namespace || 'common';
  const cacheKey = `${locale}-${translationFile}`;

  // Memoize the cache key to prevent unnecessary re-renders
  const memoizedCacheKey = useMemo(() => cacheKey, [locale, translationFile]);

  // Lazy load translation function
  const loadTranslation = useCallback(async (locale: string, file: string): Promise<any> => {
    const key = `${locale}-${file}`;
    
    // Check if already loading
    if (loadingQueue.has(key)) {
      return loadingQueue.get(key);
    }
    
    // Check cache first
    if (translationCache.has(key)) {
      return translationCache.get(key);
    }
    
    // Create loading promise
    const loadPromise = (async () => {
      try {
        const dict = await import(`../public/locales/${locale}/${file}.json`);
        const translationData = dict.default;
        
        // Cache the translation
        translationCache.set(key, translationData);
        return translationData;
      } catch (error) {
        console.error(`Error loading translations for ${key}:`, error);
        
        // Fallback to English
        if (locale !== 'en') {
          try {
            const dict = await import(`../public/locales/en/${file}.json`);
            const translationData = dict.default;
            
            // Cache the fallback translation
            translationCache.set(key, translationData);
            return translationData;
          } catch (fallbackError) {
            console.error(`Error loading fallback translations for ${key}:`, fallbackError);
            return {};
          }
        } else {
          return {};
        }
      } finally {
        // Remove from loading queue
        loadingQueue.delete(key);
      }
    })();
    
    // Add to loading queue
    loadingQueue.set(key, loadPromise);
    return loadPromise;
  }, []);

  useEffect(() => {
    const loadTranslations = async () => {
      setLoading(true);
      
      try {
        const translationData = await loadTranslation(locale, translationFile);
        setTranslations(translationData);
      } catch (error) {
        console.error('Failed to load translations:', error);
        setTranslations({});
      } finally {
        setLoading(false);
      }
    };

    loadTranslations();
  }, [locale, translationFile, loadTranslation]);

  const t = useCallback((key: string) => {
    if (loading || !translations) return key;
    
    // Support nested keys with dot notation
    const value = getNestedValue(translations, key);
    if (value === undefined || value === null) {
      logMissingTranslation(key, translationFile);
      return key;
    }
    
    return value;
  }, [loading, translations, translationFile]);

  const changeLanguage = useCallback((newLocale: string) => {
    // Save preference to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('preferred-locale', newLocale);
    }
    
    const currentPath = pathname;
    const newPath = currentPath.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPath);
  }, [locale, pathname, router]);

  // Load saved preference on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedLocale = localStorage.getItem('preferred-locale');
      if (savedLocale && savedLocale !== locale) {
        changeLanguage(savedLocale);
      }
    }
  }, [changeLanguage, locale]);

  return {
    t,
    changeLanguage,
    currentLocale: locale,
    loading,
  };
}; 