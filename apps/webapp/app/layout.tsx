import { StarsAnimation } from "@/components/stars-animation";
import "../globals.css"; // Changed from "./globals.css" to "../globals.css"
import type { Metadata } from "next";
import {
  Inter,
  Orbitron,
  Space_Mono,
  Chakra_Petch,
  Poppins,
} from "next/font/google";
import { StarknetProvider } from "@/providers/starknet-provider";
import InstallPWAButton from "@/components/InstallPWAButton";

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="data:," />
        {/* PWA Manifest & Meta Tags */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#db74cf" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <link rel="apple-touch-icon" href="/assets/icon-192x192.png" />
        <meta name="apple-mobile-web-app-title" content="StarkPulse" />
        <meta
          name="description"
          content="Decentralized Crypto News & Portfolio Platform"
        />
      </head>
      <body
        className={`${inter.variable} ${orbitron.variable} ${spaceMono.variable} ${chakraPetch.variable} ${poppins.variable}`}
      >
        <StarknetProvider>{children}</StarknetProvider>
        <InstallPWAButton />
      </body>
    </html>
  );
}
