import type { WelcomeMessage } from "@/components/ui/multilingual-welcome";

// Language detection utilities
export function isRTLLanguage(langCode: string): boolean {
  const rtlLanguages = ["ar", "he", "fa", "ur", "ps", "sd", "yi", "dv"];
  return rtlLanguages.includes(langCode.toLowerCase().split("-")[0]);
}

export function getScriptType(langCode: string): "latin" | "cyrillic" | "arabic" | "cjk" | "other" {
  const lang = langCode.toLowerCase().split("-")[0];

  if (["ar", "he", "fa", "ur", "ps", "sd", "yi", "dv"].includes(lang)) {
    return "arabic";
  }

  if (["ru", "uk", "bg", "be", "mk", "sr", "kk"].includes(lang)) {
    return "cyrillic";
  }

  if (["zh", "ja", "ko"].includes(lang)) {
    return "cjk";
  }

  if (/^[a-z]{2}(-[a-z]{2})?$/i.test(langCode)) {
    return "latin";
  }

  return "other";
}

// Generate localized welcome messages based on browser or user preferences
export async function generateLocalizedWelcomeMessages(preferredLanguages: string[] = []): Promise<WelcomeMessage[]> {
  // Default messages if no preferences provided
  if (!preferredLanguages.length) {
    if (typeof navigator !== "undefined") {
      preferredLanguages = Array.from(navigator.languages) || [navigator.language || "en"];
    } else {
      preferredLanguages = ["en"];
    }
  }

  // Map of common welcome messages
  const welcomeMessages: Record<string, string> = {
    en: "Welcome",
    fr: "Bienvenue",
    es: "Bienvenido",
    de: "Willkommen",
    zh: "欢迎",
    ja: "ようこそ",
    ko: "환영합니다",
    pt: "Bem-vindo",
    ru: "Добро пожаловать",
    ar: "مرحباً",
    hi: "स्वागत है",
    it: "Benvenuto",
    nl: "Welkom",
    tr: "Hoş geldiniz",
    pl: "Witamy",
    sv: "Välkommen",
    he: "ברוך הבא",
    th: "ยินดีต้อนรับ",
    vi: "Chào mừng",
    id: "Selamat datang",
  };

  // Language name mapping
  const languageNames: Record<string, string> = {
    en: "English",
    fr: "French",
    es: "Spanish",
    de: "German",
    zh: "Chinese",
    ja: "Japanese",
    ko: "Korean",
    pt: "Portuguese",
    ru: "Russian",
    ar: "Arabic",
    hi: "Hindi",
    it: "Italian",
    nl: "Dutch",
    tr: "Turkish",
    pl: "Polish",
    sv: "Swedish",
    he: "Hebrew",
    th: "Thai",
    vi: "Vietnamese",
    id: "Indonesian",
  };

  // Create welcome messages based on preferred languages
  const messages: WelcomeMessage[] = preferredLanguages
    .map((lang): WelcomeMessage | null => {
      const langCode = lang.split("-")[0];
      if (welcomeMessages[langCode]) {
        return {
          text: welcomeMessages[langCode],
          lang: languageNames[langCode] || langCode,
          // Use Boolean() to guarantee a boolean value
          rtl: Boolean(isRTLLanguage(langCode)),
          script: getScriptType(langCode),
        };
      }
      return null;
    })
    // Type predicate filter removes null values
    .filter((msg): msg is WelcomeMessage => msg !== null);

  // Add English as fallback if no matches found
  if (messages.length === 0) {
    messages.push({
      text: "Welcome",
      lang: "English",
      rtl: false,
      script: "latin",
    });
  }

  // Add some additional languages for variety
  const additionalLanguages = Object.keys(welcomeMessages)
    .filter((lang) => !preferredLanguages.includes(lang))
    .slice(0, 5);

  for (const lang of additionalLanguages) {
    messages.push({
      text: welcomeMessages[lang],
      lang: languageNames[lang] || lang,
      rtl: Boolean(isRTLLanguage(lang)),
      script: getScriptType(lang),
    });
  }

  return messages;
}

