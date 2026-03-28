"use client";

import { useEffect, useState } from "react";
import { motion, useSpring } from "framer-motion";

export default function BrabusCustomCursor() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const [hidden, setHidden] = useState(true);

  // Smooth springs for the outer ring
  const springConfig = { damping: 25, stiffness: 200, mass: 0.5 };
  const cursorX = useSpring(0, springConfig);
  const cursorY = useSpring(0, springConfig);

  useEffect(() => {
    // Only apply on desktop
    if (window.innerWidth < 768) return;

    // Hide standard cursor globally while this component routes
    document.documentElement.style.cursor = "none";
    
    // Elements should also inherit the cursor hide to avoid flickers
    document.body.classList.add('br-custom-cursor-active');

    const moveCursor = (e: MouseEvent) => {
      setHidden(false);
      setPosition({ x: e.clientX, y: e.clientY });
      cursorX.set(e.clientX - 16); // Center the 32px ring
      cursorY.set(e.clientY - 16);
    };

    const handleMouseLeave = () => setHidden(true);
    const handleMouseEnter = () => setHidden(false);

    // Track when hovering actionable elements (magnetic feel)
    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        window.getComputedStyle(target).cursor === 'pointer' ||
        target.tagName.toLowerCase() === "a" ||
        target.tagName.toLowerCase() === "button" ||
        target.closest("a") ||
        target.closest("button")
      ) {
        setIsHovering(true);
      } else {
        setIsHovering(false);
      }
    };

    window.addEventListener("mousemove", moveCursor);
    document.addEventListener("mouseleave", handleMouseLeave);
    document.addEventListener("mouseover", handleMouseOver);
    document.addEventListener("mouseenter", handleMouseEnter);

    return () => {
      document.documentElement.style.cursor = "auto";
      document.body.classList.remove('br-custom-cursor-active');
      window.removeEventListener("mousemove", moveCursor);
      document.removeEventListener("mouseleave", handleMouseLeave);
      document.removeEventListener("mouseover", handleMouseOver);
      document.removeEventListener("mouseenter", handleMouseEnter);
    };
  }, [cursorX, cursorY]);

  // Don't render on mobile or SSR
  if (hidden || typeof window === 'undefined' || window.innerWidth < 768) return null;

  return (
    <>
      <style jsx global>{`
        .br-custom-cursor-active,
        .br-custom-cursor-active * {
          cursor: none !important;
        }
      `}</style>
      <div className="pointer-events-none fixed inset-0 z-[9999]">
        {/* Outer physics ring */}
        <motion.div
          className="absolute left-0 top-0 rounded-full border border-[#cc0000] mix-blend-screen"
          style={{
            x: cursorX,
            y: cursorY,
            width: 32,
            height: 32,
          }}
          animate={{
            scale: isHovering ? 1.5 : 1,
            opacity: isHovering ? 0 : 0.6,
          }}
          transition={{ duration: 0.2 }}
        />
        {/* Exact hardware-centered dot */}
        <motion.div
          className="absolute left-0 top-0 w-2 h-2 rounded-full bg-[#cc0000] -ml-1 -mt-1 mix-blend-screen"
          style={{
            boxShadow: '0 0 10px 2px rgba(204,0,0,0.8)'
          }}
          animate={{
            x: position.x,
            y: position.y,
            scale: isHovering ? 4 : 1,
            backgroundColor: isHovering ? "rgba(204,0,0,0.5)" : "rgba(204,0,0,1)",
            boxShadow: isHovering ? '0 0 15px 4px rgba(204,0,0,0.4)' : '0 0 10px 2px rgba(204,0,0,0.8)'
          }}
          transition={{ type: "spring", stiffness: 1000, damping: 28, mass: 0.1 }}
        />
      </div>
    </>
  );
}
