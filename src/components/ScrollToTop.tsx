"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import clsx from "clsx";

export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > 500) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener("scroll", toggleVisibility);
    return () => window.removeEventListener("scroll", toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <button
      onClick={scrollToTop}
      className={clsx(
        "fixed bottom-8 right-8 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-foreground/10 bg-card/75 dark:bg-background/50 text-foreground backdrop-blur-md transition-all duration-300 hover:bg-card hover:text-primary-foreground hover:scale-110",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"
      )}
      aria-label="Scroll to top"
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}
