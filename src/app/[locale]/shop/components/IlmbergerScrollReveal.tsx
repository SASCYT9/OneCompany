/**
 * Adapted from reactbits.dev (MIT + Commons Clause).
 * Source: https://github.com/DavidHDev/react-bits/tree/main/src/ts-tailwind/TextAnimations/ScrollReveal
 *
 * GSAP-driven, scroll-scrubbed word-by-word reveal with subtle rotation +
 * blur unblur. Used to wrap section titles (h2) so each word fades and
 * unblurs as the heading enters the viewport. Pure cosmetic — non-interactive.
 *
 * Adapted: removed inner <p> wrapper, render as inline element so we keep
 * our existing `.il-section-title` styling. Respects prefers-reduced-motion
 * via a CSS guard in il-shop.css.
 */

"use client";

import React, { useEffect, useRef, useMemo, type ReactNode, type RefObject } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

interface ScrollRevealProps {
  children: ReactNode;
  scrollContainerRef?: RefObject<HTMLElement>;
  enableBlur?: boolean;
  baseOpacity?: number;
  baseRotation?: number;
  blurStrength?: number;
  className?: string;
  rotationEnd?: string;
  wordAnimationEnd?: string;
  /** Element type used as outer container — defaults to span so it can drop
   *  in inside our existing h1/h2/p without nesting block-level tags. */
  as?: "span" | "div";
}

const IlmbergerScrollReveal: React.FC<ScrollRevealProps> = ({
  children,
  scrollContainerRef,
  enableBlur = true,
  baseOpacity = 0.15,
  baseRotation = 2.5,
  blurStrength = 4,
  className = "",
  rotationEnd = "bottom bottom",
  wordAnimationEnd = "bottom bottom",
  as = "span",
}) => {
  const containerRef = useRef<HTMLElement>(null);

  const splitText = useMemo(() => {
    const text = typeof children === "string" ? children : "";
    return text.split(/(\s+)/).map((word, index) => {
      if (word.match(/^\s+$/)) return word;
      return (
        <span className="inline-block il-sr-word" key={index}>
          {word}
        </span>
      );
    });
  }, [children]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const scroller =
      scrollContainerRef && scrollContainerRef.current ? scrollContainerRef.current : window;

    const ctx = gsap.context(() => {
      const wordElements = el.querySelectorAll<HTMLElement>(".il-sr-word");

      gsap.fromTo(
        wordElements,
        { opacity: baseOpacity, willChange: "opacity" },
        {
          ease: "none",
          opacity: 1,
          stagger: 0.05,
          scrollTrigger: {
            trigger: el,
            scroller,
            start: "top bottom-=20%",
            end: wordAnimationEnd,
            scrub: true,
          },
        }
      );

      if (enableBlur) {
        gsap.fromTo(
          wordElements,
          { filter: `blur(${blurStrength}px)` },
          {
            ease: "none",
            filter: "blur(0px)",
            stagger: 0.05,
            scrollTrigger: {
              trigger: el,
              scroller,
              start: "top bottom-=20%",
              end: wordAnimationEnd,
              scrub: true,
            },
          }
        );
      }
    }, el);

    return () => ctx.revert();
  }, [
    scrollContainerRef,
    enableBlur,
    baseRotation,
    baseOpacity,
    rotationEnd,
    wordAnimationEnd,
    blurStrength,
  ]);

  const Wrapper = as as "span" | "div";
  return (
    // @ts-expect-error — generic ref typing on dynamic element
    <Wrapper ref={containerRef} className={className}>
      {splitText}
    </Wrapper>
  );
};

export default IlmbergerScrollReveal;
