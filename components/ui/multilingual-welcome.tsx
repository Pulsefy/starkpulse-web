"use client"

import { useEffect, useRef, useState } from "react"
import { textChangeAnimation, fadeInAnimation } from "@/lib/text-animations"
import { z } from "zod"
import { cn } from "@/lib/utils"

// Enhanced data model with RTL support and script information
export interface WelcomeMessage {
  text: string
  lang: string
  rtl?: boolean
  script?: "latin" | "cyrillic" | "arabic" | "cjk" | "other"
}

// Zod schema for data validation
export const WelcomeMessageSchema = z.object({
  text: z.string().min(1, "Message text cannot be empty"),
  lang: z.string().min(1, "Language name cannot be empty"),
  rtl: z.boolean().optional().default(false),
  script: z.enum(["latin", "cyrillic", "arabic", "cjk", "other"]).optional().default("latin"),
})

export const WelcomeMessagesArraySchema = z.array(WelcomeMessageSchema)

interface MultilingualWelcomeProps {
  messages?: WelcomeMessage[]
  interval?: number
  className?: string
  textClassName?: string
  animationDirection?: "normal" | "reverse" | "alternate"
  onLanguageChange?: (message: WelcomeMessage) => void
}

export function MultilingualWelcome({
  messages = [
    { text: "Welcome", lang: "English", script: "latin" },
    { text: "Bienvenue", lang: "French", script: "latin" },
    { text: "Bienvenido", lang: "Spanish", script: "latin" },
    { text: "Willkommen", lang: "German", script: "latin" },
    { text: "欢迎", lang: "Chinese", rtl: false, script: "cjk" },
    { text: "ようこそ", lang: "Japanese", rtl: false, script: "cjk" },
    { text: "환영합니다", lang: "Korean", rtl: false, script: "cjk" },
    { text: "Bem-vindo", lang: "Portuguese", script: "latin" },
    { text: "Добро пожаловать", lang: "Russian", script: "cyrillic" },
    { text: "مرحباً", lang: "Arabic", rtl: true, script: "arabic" },
  ],
  interval = 3000,
  className = "text-5xl md:text-6xl font-bold text-white mb-6 font-raleway min-h-[80px] flex items-center",
  textClassName = "text-white",
  animationDirection = "normal",
  onLanguageChange,
}: MultilingualWelcomeProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const textRef = useRef<HTMLHeadingElement>(null)
  const [validatedMessages, setValidatedMessages] = useState<WelcomeMessage[]>(messages)

  // Validate messages on component mount
  useEffect(() => {
    try {
      const result = WelcomeMessagesArraySchema.parse(messages)
      setValidatedMessages(result)
    } catch (error) {
      console.error("Invalid welcome messages data:", error)
      // Fallback to default messages if validation fails
    }
  }, [messages])

  useEffect(() => {
    // Animation for text change with direction control
    const changeText = () => {
      if (textRef.current) {
        textChangeAnimation(
          textRef.current,
          () => {
            setCurrentIndex((prevIndex) => {
              const newIndex = (prevIndex + 1) % validatedMessages.length

              // Notify parent component about language change
              if (onLanguageChange) {
                onLanguageChange(validatedMessages[newIndex])
              }

              return newIndex
            })
          },
          { direction: animationDirection },
        )
      }
    }

    // Set interval for changing text
    const intervalId = setInterval(changeText, interval)

    // Initial animation
    if (textRef.current) {
      fadeInAnimation(textRef.current, { direction: animationDirection })
    }

    // Clean up interval on component unmount
    return () => clearInterval(intervalId)
  }, [validatedMessages.length, interval, animationDirection, onLanguageChange, validatedMessages])

  const currentMessage = validatedMessages[currentIndex]

  return (
    <h1
      ref={textRef}
      className={cn(className, currentMessage?.rtl && "direction-rtl")}
      dir={currentMessage?.rtl ? "rtl" : "ltr"}
      lang={currentMessage?.lang.toLowerCase()}
    >
      <span
        className={cn(
          textClassName,
          currentMessage?.script === "arabic" && "font-arabic",
          currentMessage?.script === "cyrillic" && "font-cyrillic",
          currentMessage?.script === "cjk" && "font-cjk",
        )}
      >
        {currentMessage?.text}
      </span>
    </h1>
  )
}

