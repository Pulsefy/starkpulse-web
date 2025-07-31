import 'server-only';

const dictionaries = {
  en: () => import('../public/locales/en/common.json').then((module) => module.default),
  fr: () => import('../public/locales/fr/common.json').then((module) => module.default),
};

export const getDictionary = async (locale: string) => {
  return dictionaries[locale as keyof typeof dictionaries]?.() ?? dictionaries.en();
}; 