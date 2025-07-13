"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { textChangeAnimation, fadeInAnimation } from "@/lib/text-animations";
import { z } from "zod";
import { cn } from "@/lib/utils";

// Enhanced data model with RTL support and script information
export interface WelcomeMessage {
  text: string;
  lang: string;
  rtl?: boolean;
  script?: "latin" | "cyrillic" | "arabic" | "cjk" | "other";
}

// Zod schema for data validation
export const WelcomeMessageSchema = z.object({
  text: z.string().min(1, "Message text cannot be empty"),
  lang: z.string().min(1, "Language name cannot be empty"),
  rtl: z.boolean().optional().default(false),
  script: z
    .enum(["latin", "cyrillic", "arabic", "cjk", "other"])
    .optional()
    .default("latin"),
});

export const WelcomeMessagesArraySchema = z.array(WelcomeMessageSchema);

// Move default messages outside component to prevent recreation
const DEFAULT_MESSAGES: WelcomeMessage[] = [
  { text: "Welcome", lang: "English", rtl: false, script: "latin" },
  { text: "Bienvenue", lang: "French", rtl: false, script: "latin" },
  { text: "Bienvenido", lang: "Spanish", rtl: false, script: "latin" },
  { text: "Willkommen", lang: "German", rtl: false, script: "latin" },
  { text: "欢迎", lang: "Chinese", rtl: false, script: "cjk" },
  { text: "ようこそ", lang: "Japanese", rtl: false, script: "cjk" },
  { text: "환영합니다", lang: "Korean", rtl: false, script: "cjk" },
  { text: "Bem-vindo", lang: "Portuguese", rtl: false, script: "latin" },
  { text: "Добро пожаловать", lang: "Russian", rtl: false, script: "cyrillic" },
  { text: "مرحباً", lang: "Arabic", rtl: true, script: "arabic" },
];

interface MultilingualWelcomeProps {
  messages?: WelcomeMessage[];
  interval?: number;
  className?: string;
  textClassName?: string;
  animationDirection?: "normal" | "reverse" | "alternate";
  onLanguageChange?: (message: WelcomeMessage) => void;
}

export function MultilingualWelcome({
  messages,
  interval = 3000,
  className = "text-5xl md:text-6xl font-bold text-white mb-6 font-raleway min-h-[80px] flex items-center",
  textClassName = "text-white",
  animationDirection = "normal",
  onLanguageChange,
}: MultilingualWelcomeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const textRef = useRef<HTMLHeadingElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const onLanguageChangeRef = useRef(onLanguageChange);

  // Memoize validated messages to prevent infinite re-renders
  const validatedMessages = useMemo(() => {
    const messagesToValidate = messages || DEFAULT_MESSAGES;
    try {
      const result = WelcomeMessagesArraySchema.parse(messagesToValidate);
      return result;
    } catch (error) {
      console.error("Invalid welcome messages data:", error);
      // Return default messages if validation fails
      return [{ text: "Welcome", lang: "English", rtl: false, script: "latin" as const }];
    }
  }, [messages]);

  // Update the ref when onLanguageChange changes
  useEffect(() => {
    onLanguageChangeRef.current = onLanguageChange;
  }, [onLanguageChange]);

  // Set up the interval effect
  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Only set up interval if we have validated messages
    if (validatedMessages.length > 0) {
      // Initial animation
      if (textRef.current) {
        fadeInAnimation(textRef.current, { direction: animationDirection });
      }

      // Set interval for changing text
      intervalRef.current = setInterval(() => {
        if (textRef.current && validatedMessages.length > 0) {
          textChangeAnimation(
            textRef.current,
            () => {
              setCurrentIndex((prevIndex) => {
                const newIndex = (prevIndex + 1) % validatedMessages.length;

                // Notify parent component about language change
                if (onLanguageChangeRef.current) {
                  onLanguageChangeRef.current(validatedMessages[newIndex]);
                }

                return newIndex;
              });
            },
            { direction: animationDirection }
          );
        }
      }, interval);
    }

    // Clean up interval on component unmount or dependency change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [validatedMessages, interval, animationDirection]);

  const currentMessage = validatedMessages[currentIndex] || validatedMessages[0];

  if (!currentMessage) {
    return null;
  }

  return (
    <h1
      ref={textRef}
      className={cn(className, currentMessage.rtl && "direction-rtl")}
      dir={currentMessage.rtl ? "rtl" : "ltr"}
      lang={currentMessage.lang.toLowerCase()}
    >
      <span
        className={cn(
          textClassName,
          currentMessage.script === "arabic" && "font-arabic",
          currentMessage.script === "cyrillic" && "font-cyrillic",
          currentMessage.script === "cjk" && "font-cjk"
        )}
      >
        {currentMessage.text}
      </span>
    </h1>
  );
}
