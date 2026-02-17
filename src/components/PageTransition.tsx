import { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [phase, setPhase] = useState<"visible" | "fade-out" | "fade-in">("visible");
  const prevPathname = useRef(location.pathname);

  useEffect(() => {
    if (location.pathname !== prevPathname.current) {
      prevPathname.current = location.pathname;
      setPhase("fade-out");
      const timeout = setTimeout(() => {
        setDisplayChildren(children);
        setPhase("fade-in");
        const timeout2 = setTimeout(() => setPhase("visible"), 180);
        return () => clearTimeout(timeout2);
      }, 120);
      return () => clearTimeout(timeout);
    } else {
      setDisplayChildren(children);
    }
  }, [children, location.pathname]);

  return (
    <div
      className="w-full h-full"
      style={{
        opacity: phase === "fade-out" ? 0 : 1,
        transition: "opacity 120ms ease-out",
      }}
    >
      {displayChildren}
    </div>
  );
}
