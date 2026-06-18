"use client";

import { useRef, useState, useEffect } from "react";

export function useScrollReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); observer.unobserve(el); } },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, isVisible };
}

export function useStaggerReveal(count: number, delayMs = 100) {
  const { ref, isVisible } = useScrollReveal(0.1);
  const getDelay = (i: number) => ({ transitionDelay: `${i * delayMs}ms` } as React.CSSProperties);
  return { ref, isVisible, getDelay, count };
}
