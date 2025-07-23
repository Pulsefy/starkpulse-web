// Date formatting utilities
export const formatDate = (date: Date | string, locale: string = 'en'): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(dateObj);
};

export const formatDateTime = (date: Date | string, locale: string = 'en'): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dateObj);
};

export const formatRelativeTime = (date: Date | string, locale: string = 'en'): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);
  
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  
  if (diffInSeconds < 60) {
    return rtf.format(-diffInSeconds, 'second');
  } else if (diffInSeconds < 3600) {
    return rtf.format(-Math.floor(diffInSeconds / 60), 'minute');
  } else if (diffInSeconds < 86400) {
    return rtf.format(-Math.floor(diffInSeconds / 3600), 'hour');
  } else {
    return rtf.format(-Math.floor(diffInSeconds / 86400), 'day');
  }
};

// Number formatting utilities
export const formatNumber = (num: number, locale: string = 'en', options?: Intl.NumberFormatOptions): string => {
  return new Intl.NumberFormat(locale, options).format(num);
};

export const formatCurrency = (amount: number, currency: string = 'USD', locale: string = 'en'): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
  }).format(amount);
};

export const formatCryptoValue = (value: number, locale: string = 'en'): string => {
  if (value >= 1e12) {
    return `${formatNumber(value / 1e12, locale)}T`;
  } else if (value >= 1e9) {
    return `${formatNumber(value / 1e9, locale)}B`;
  } else if (value >= 1e6) {
    return `${formatNumber(value / 1e6, locale)}M`;
  } else if (value >= 1e3) {
    return `${formatNumber(value / 1e3, locale)}K`;
  } else {
    return formatNumber(value, locale, { maximumFractionDigits: 2 });
  }
};

export const formatPercentage = (value: number, locale: string = 'en'): string => {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100);
};

// Pluralization utilities
export const pluralize = (count: number, singular: string, plural: string, locale: string = 'en'): string => {
  const pluralRules = new Intl.PluralRules(locale);
  const rule = pluralRules.select(count);
  
  if (rule === 'one') {
    return `${count} ${singular}`;
  } else {
    return `${count} ${plural}`;
  }
}; 