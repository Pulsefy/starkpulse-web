import { StarsAnimation } from "@/components/stars-animation";
import "../globals.css"; // Changed from "./globals.css" to "../globals.css"
import type { Metadata } from "next";
import {
	Chakra_Petch,
	Inter,
	Orbitron,
	Poppins,
	Space_Mono,
} from "next/font/google";
import { StarknetProvider } from "@/providers/starknet-provider";

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
			</head>
			<body
				className={`${inter.variable} ${orbitron.variable} ${spaceMono.variable} ${chakraPetch.variable} ${poppins.variable}`}
			>
				<StarknetProvider>{children}</StarknetProvider>
			</body>
		</html>
	);
}
