'use client';

import { Globe } from "@/components/globe";
import { ButtonGroup } from "@/components/button-group";
import { useTranslation } from "@/hooks/useTranslation";

export function HomeView() {
  const { t, changeLanguage, currentLocale } = useTranslation();

  return (
    <main className="w-full h-screen overflow-hidden">
      <section className="relative w-full h-full flex items-center justify-center">
        <div className="absolute inset-0 w-full h-full">
          <Globe />
        </div>
        <div className="container relative z-10 text-center px-4">
          <h1 className="text-5xl font-bold mb-6 font-heading tracking-tight text-white">
            {t('hero_title')}
          </h1>
          <p className="text-lg mb-8 max-w-xl mx-auto font-light leading-relaxed tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-white/90 via-white to-white/90">
            {t('hero_subtitle')}
          </p>
          <ButtonGroup />
          
          {/* Language selector */}
          <div className="mt-8 flex justify-center gap-2">
            <button 
              onClick={() => changeLanguage('en')}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                currentLocale === 'en' 
                  ? 'bg-white text-black' 
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              EN
            </button>
            <button 
              onClick={() => changeLanguage('fr')}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                currentLocale === 'fr' 
                  ? 'bg-white text-black' 
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              FR
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
