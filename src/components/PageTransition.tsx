import { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [phase, setPhase] = useState<"enter" | "exit">("enter");
  const prevKey = useRef(location.key);

  useEffect(() => {
    if (location.key !== prevKey.current) {
      prevKey.current = location.key;
      setPhase("exit");
      const timeout = setTimeout(() => {
        setDisplayChildren(children);
        setPhase("enter");
      }, 150);
      return () => clearTimeout(timeout);
    } else {
      setDisplayChildren(children);
    }
  }, [children, location.key]);

  return (
    <div
      className={`w-full h-full transition-all duration-150 ease-out ${
        phase === "exit"
          ? "opacity-0 translate-x-2"
          : "opacity-100 translate-x-0"
      }`}
    >
      {displayChildren}
    </div>
  );
}
