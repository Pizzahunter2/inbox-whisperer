import { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [phase, setPhase] = useState<"visible" | "fade-out" | "fade-in">("visible");
  const prevKey = useRef(location.key);

  useEffect(() => {
    if (location.key !== prevKey.current) {
      prevKey.current = location.key;
      // Fade out current content
      setPhase("fade-out");
      const timeout = setTimeout(() => {
        // Swap content and fade in
        setDisplayChildren(children);
        setPhase("fade-in");
        // Remove animation class after it completes
        const clearTimeout2 = setTimeout(() => setPhase("visible"), 200);
        return () => clearTimeout(clearTimeout2);
      }, 150);
      return () => clearTimeout(timeout);
    } else {
      setDisplayChildren(children);
    }
  }, [children, location.key]);

  const animationClass =
    phase === "fade-out"
      ? "opacity-0 -translate-x-3"
      : phase === "fade-in"
        ? "opacity-0 translate-x-3 animate-[page-enter_0.2s_ease-out_forwards]"
        : "";

  return (
    <div
      className={`w-full h-full transition-[opacity,transform] duration-150 ease-out ${animationClass}`}
    >
      {displayChildren}
    </div>
  );
}
