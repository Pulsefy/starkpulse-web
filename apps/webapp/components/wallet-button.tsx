"use client";

import { Wallet } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";

const WalletButton = ({
	onClick,
	children,
}: {
	onClick?: () => void;
	children?: React.ReactNode;
}) => {
	// Add client-side only rendering
	const [isMounted, setIsMounted] = useState(false);

	useEffect(() => {
		setIsMounted(true);
	}, []);

	// Return a simple placeholder during server-side rendering
	if (!isMounted) {
		return (
			<div className="font-['Orbitron']">
				<button
					type="button"
					className="relative flex justify-center items-center w-40 h-12 overflow-hidden rounded-full 
                  bg-[#161a25] border-4 border-double border-[#db74cf]/30"
				>
					<span className="text-xs tracking-[3px] text-white">
						{children || "CONNECT"}
					</span>
				</button>
			</div>
		);
	}

	return (
		<div className="font-['Orbitron']">
			<button
				type="button"
				onClick={onClick}
				className="relative flex justify-center items-center w-40 h-12 overflow-hidden rounded-full 
                  bg-[#161a25] bg-[length:300%_300%] backdrop-blur-md transition-all duration-500 
                  hover:scale-110 active:border-[#db74cf] active:border-4 active:border-double
                  border-4 border-double border-transparent
                  bg-gradient-to-r from-[#161a25] to-[#161a25] 
                  bg-origin-border"
				style={{
					backgroundImage: `
            linear-gradient(#161a25, #161a25),
            linear-gradient(
              137.48deg,
              #db74cf 10%,
              #631e29 45%,
              #000000 67%,
              #161a25 87%
            )
          `,
					backgroundOrigin: "border-box",
					backgroundClip: "content-box, border-box",
					animation: "gradient_301 5s ease infinite",
				}}
			>
				<div className="flex items-center justify-center z-20 relative">
					<Wallet className="w-4 h-4 text-white mr-2" />
					<strong className="text-xs tracking-[3px] text-white text-shadow-sm shadow-white">
						{children || "CONNECT"}
					</strong>
				</div>

				{/* Container Stars */}
				<div
					className="absolute z-[1] w-full h-full overflow-hidden transition-all duration-500 
                      backdrop-blur-md rounded-full hover:bg-[#161a25]"
					id="container-stars"
				>
					<div
						className="relative w-[200rem] h-[200rem] bg-transparent
                        before:content-[''] before:absolute before:top-0 before:left-[-50%] 
                        before:w-[170%] before:h-[500%] before:animate-animStar
                        before:bg-[radial-gradient(#ffffff_1px,transparent_1%)] before:bg-[length:50px_50px] before:opacity-50
                        after:content-[''] after:absolute after:top-[-10rem] after:left-[-100rem] 
                        after:w-full after:h-full after:animate-animStarRotate
                        after:bg-[radial-gradient(#ffffff_1px,transparent_1%)] after:bg-[length:50px_50px]"
						id="stars"
					></div>
				</div>

				{/* Glow Effect */}
				<div className="absolute flex w-48" id="glow">
					<div className="absolute w-[30px] h-[30px] rounded-full blur-2xl bg-[rgba(219,116,207,0.636)] animate-orbit1"></div>
					<div className="absolute w-[30px] h-[30px] rounded-full blur-2xl bg-[rgba(219,116,207,0.4)] animate-orbit2"></div>
				</div>
			</button>
		</div>
	);
};

export default WalletButton;
