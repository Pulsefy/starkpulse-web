// RTL support utilities for future implementation

export const RTL_LOCALES = ['ar', 'he', 'fa', 'ur', 'ps', 'sd'];

export const isRTLLocale = (locale: string): boolean => {
  return RTL_LOCALES.includes(locale);
};

export const getTextDirection = (locale: string): 'ltr' | 'rtl' => {
  return isRTLLocale(locale) ? 'rtl' : 'ltr';
};

export const getTextAlignment = (locale: string): 'left' | 'right' => {
  return isRTLLocale(locale) ? 'right' : 'left';
};

export const getFlexDirection = (locale: string): 'row' | 'row-reverse' => {
  return isRTLLocale(locale) ? 'row-reverse' : 'row';
};

// CSS utilities for RTL support
export const getRTLStyles = (locale: string) => {
  const isRTL = isRTLLocale(locale);
  
  return {
    direction: isRTL ? 'rtl' : 'ltr',
    textAlign: isRTL ? 'right' : 'left',
    transform: isRTL ? 'scaleX(-1)' : 'none',
  };
};

// Number formatting for RTL locales
export const formatNumberRTL = (num: number, locale: string): string => {
  if (isRTLLocale(locale)) {
    // For RTL locales, we might need special number formatting
    return new Intl.NumberFormat(locale).format(num);
  }
  return new Intl.NumberFormat(locale).format(num);
}; 