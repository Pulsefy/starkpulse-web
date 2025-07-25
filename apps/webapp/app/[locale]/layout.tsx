import { StarsAnimation } from "@/components/stars-animation";
import "../../globals.css";
import type { Metadata } from "next";
import {
  Inter,
  Orbitron,
  Space_Mono,
  Chakra_Petch,
  Poppins,
} from "next/font/google";
import { StarknetProvider } from "@/providers/starknet-provider";
import { getDictionary } from '@/lib/getDictionary';

// Font definitions
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-orbitron",
  display: "swap",
});

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-space-mono",
  display: "swap",
});

const chakraPetch = Chakra_Petch({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-chakra",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "StarkPulse - Decentralized Crypto News Platform",
  description:
    "Your trusted source for crypto news, trends, and insights powered by StarkNet.",
};

export default async function LocaleLayout({
  children,
  params: { locale }
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  return (
    <html lang={locale}>
      <head>
        <link rel="icon" href="data:," />
      </head>
      <body
        className={`${inter.variable} ${orbitron.variable} ${spaceMono.variable} ${chakraPetch.variable} ${poppins.variable}`}
      >
        <StarknetProvider>{children}</StarknetProvider>
      </body>
    </html>
  );
} 