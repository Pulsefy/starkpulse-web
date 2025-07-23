// Translation validation utilities

interface TranslationValidationResult {
  missingKeys: string[];
  extraKeys: string[];
  isValid: boolean;
}

export const validateTranslations = (
  sourceTranslations: Record<string, any>,
  targetTranslations: Record<string, any>,
  namespace: string = 'unknown'
): TranslationValidationResult => {
  const sourceKeys = Object.keys(sourceTranslations);
  const targetKeys = Object.keys(targetTranslations);
  
  const missingKeys = sourceKeys.filter(key => !targetKeys.includes(key));
  const extraKeys = targetKeys.filter(key => !sourceKeys.includes(key));
  
  const isValid = missingKeys.length === 0;
  
  if (!isValid) {
    console.warn(`Translation validation failed for namespace "${namespace}":`, {
      missingKeys,
      extraKeys,
    });
  }
  
  return {
    missingKeys,
    extraKeys,
    isValid,
  };
};

export const detectMissingKeys = (
  translations: Record<string, any>,
  namespace: string = 'unknown'
): string[] => {
  const missingKeys: string[] = [];
  
  const checkObject = (obj: any, path: string = '') => {
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      
      if (value === undefined || value === null || value === '') {
        missingKeys.push(currentPath);
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        checkObject(value, currentPath);
      }
    }
  };
  
  checkObject(translations);
  
  if (missingKeys.length > 0) {
    console.warn(`Missing translation keys in namespace "${namespace}":`, missingKeys);
  }
  
  return missingKeys;
};

export const validateTranslationStructure = (
  translations: Record<string, any>,
  requiredKeys: string[],
  namespace: string = 'unknown'
): boolean => {
  const missingRequiredKeys = requiredKeys.filter(key => !(key in translations));
  
  if (missingRequiredKeys.length > 0) {
    console.error(`Missing required keys in namespace "${namespace}":`, missingRequiredKeys);
    return false;
  }
  
  return true;
};

// Development-only translation key logger
export const logMissingTranslation = (key: string, namespace: string = 'unknown') => {
  if (process.env.NODE_ENV === 'development') {
    console.warn(`Missing translation key: "${key}" in namespace "${namespace}"`);
  }
};

// Translation completeness checker
export const getTranslationCompleteness = (
  sourceTranslations: Record<string, any>,
  targetTranslations: Record<string, any>
): number => {
  const sourceKeys = Object.keys(sourceTranslations);
  const targetKeys = Object.keys(targetTranslations);
  
  const translatedKeys = sourceKeys.filter(key => targetKeys.includes(key));
  return (translatedKeys.length / sourceKeys.length) * 100;
}; 