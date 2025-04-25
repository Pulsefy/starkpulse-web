import { StarsAnimation } from "@/components/stars-animation";
import "./globals.css";
import type { Metadata } from "next";
import {
  Inter,
  Orbitron,
  Space_Mono,
  Chakra_Petch,
  Poppins,
} from "next/font/google";

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

export const metadata: Metadata = {
  title: "StarkPulse - Decentralized Crypto News Platform",
  description:
    "Your trusted source for crypto news, trends, and insights powered by StarkNet.",
};

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
});

// Add this import at the top
import { StarknetProvider } from "@/providers/starknet-provider";
import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <StarknetProvider>{children}</StarknetProvider>
      </body>
    </html>
  );
}
