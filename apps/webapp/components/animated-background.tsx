"use client";

import { useEffect, useRef } from "react";
import { Globe } from "./globe";
import { StarsAnimation } from "./stars-animation";

export function AnimatedBackground() {
	const containerRef = useRef<HTMLDivElement>(null);

	return (
		<div ref={containerRef} className="fixed inset-0 z-[-1] overflow-hidden">
			<div className="absolute inset-0 bg-gradient-to-b from-black via-black/95 to-black/90"></div>
			<StarsAnimation />
			<div className="absolute inset-0 flex items-center justify-center">
				<Globe />
			</div>
		</div>
	);
}
