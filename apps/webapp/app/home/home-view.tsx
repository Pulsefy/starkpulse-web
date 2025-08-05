import { Globe } from "@/components/globe";
import { ButtonGroup } from "@/components/button-group";

export function HomeView() {
  return (
    <main className="w-full h-screen overflow-hidden">
      <section className="relative w-full h-full flex items-center justify-center">
        <div className="absolute inset-0 w-full h-full">
          <Globe />
        </div>
        <div className="container relative z-10 text-center px-4">
          <h1 className="text-5xl font-bold mb-6 font-heading tracking-tight text-white">
            Stark<span className="animate-pulse-text">Pulse</span>
          </h1>
          <p className="text-lg mb-8 max-w-xl mx-auto font-light leading-relaxed tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-white/90 via-white to-white/90">
            Delivering real-time blockchain intelligence and cutting edge
            insights for the next generation of decentralized finance, powered
            by a community driven platform with token-based incentives.
          </p>
          <ButtonGroup />
        </div>
      </section>
    </main>
  );
}
