import { gsap } from "gsap";

interface AnimationOptions {
	direction?: "normal" | "reverse" | "alternate";
	duration?: number;
	ease?: string;
}

export function textChangeAnimation(
	element: HTMLElement,
	onComplete: () => void,
	options: AnimationOptions = {},
) {
	const { duration = 0.5, ease = "power2.inOut" } = options;

	gsap.to(element, {
		opacity: 0,
		duration: duration / 2,
		ease: ease,
		onComplete: () => {
			onComplete();
			gsap.to(element, {
				opacity: 1,
				duration: duration / 2,
				ease: ease,
			});
		},
	});
}

export function containerFadeIn(
	element: HTMLElement,
	options: AnimationOptions = {},
) {
	// Mock implementation - replace with your actual GSAP animation
	const { duration = 1 } = options;

	// Set initial state
	element.style.opacity = "0";
	element.style.transform = "translateY(20px)";

	// Animate in
	setTimeout(() => {
		element.style.transition = `opacity ${duration}s ease-out, transform ${duration}s ease-out`;
		element.style.opacity = "1";
		element.style.transform = "translateY(0)";
	}, 10);
}

export function fadeInAnimation(
	element: HTMLElement,
	options: AnimationOptions = {},
) {
	// Mock implementation - replace with your actual GSAP animation
	const { direction = "normal", duration = 1 } = options;

	// Simulate animation
	element.style.opacity = "0";
	setTimeout(() => {
		element.style.opacity = "1";
	}, 10);
}
