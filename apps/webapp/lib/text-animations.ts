interface AnimationOptions {
    direction?: "normal" | "reverse" | "alternate"
    duration?: number
    ease?: string
  }
  
  export function textChangeAnimation(element: HTMLElement, onComplete: () => void, options: AnimationOptions = {}) {
    // Mock implementation - replace with your actual GSAP animation
    const { direction = "normal", duration = 0.5 } = options
  
    // Simulate animation with setTimeout
    setTimeout(() => {
      element.style.opacity = "0"
  
      setTimeout(() => {
        onComplete()
        element.style.opacity = "1"
      }, duration * 500)
    }, duration * 500)
  
    // Note: In a real implementation, you would use GSAP like:
    /*
    import gsap from "gsap";
    
    gsap.to(element, {
      opacity: 0,
      duration: duration / 2,
      onComplete: () => {
        onComplete();
        gsap.to(element, {
          opacity: 1,
          duration: duration / 2,
          ease: options.ease || "power2.inOut"
        });
      },
      ease: options.ease || "power2.inOut"
    });
    */
  }
  
  export function fadeInAnimation(element: HTMLElement, options: AnimationOptions = {}) {
    // Mock implementation - replace with your actual GSAP animation
    const { direction = "normal", duration = 1 } = options
  
    // Simulate animation
    element.style.opacity = "0"
    setTimeout(() => {
      element.style.opacity = "1"
    }, 10)
  
    
  }
  
  