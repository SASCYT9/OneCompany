/**
 * Adapted from reactbits.dev (MIT + Commons Clause).
 * Source: https://github.com/DavidHDev/react-bits/tree/main/src/ts-tailwind/Components/TiltedCard
 *
 * Mouse-tracked 3D tilt card. Wraps a Next/Link with our category content
 * (full-photo cover + scrim + badge + name + desc panel). On mobile / touch
 * the tilt math is skipped automatically because there's no mousemove.
 */

"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion, useMotionValue, useSpring, type SpringOptions } from "framer-motion";

interface IlmbergerTiltedCardProps {
  href: string;
  image: string;
  objectPosition?: string;
  badge: string;
  name: string;
  description: string;
  scaleOnHover?: number;
  rotateAmplitude?: number;
}

const springValues: SpringOptions = {
  damping: 28,
  stiffness: 110,
  mass: 1.6,
};

export default function IlmbergerTiltedCard({
  href,
  image,
  objectPosition = "center",
  badge,
  name,
  description,
  scaleOnHover = 1.04,
  rotateAmplitude = 10,
}: IlmbergerTiltedCardProps) {
  const ref = useRef<HTMLAnchorElement>(null);
  const rotateX = useSpring(useMotionValue(0), springValues);
  const rotateY = useSpring(useMotionValue(0), springValues);
  const scale = useSpring(1, springValues);

  function handleMouse(e: React.MouseEvent<HTMLAnchorElement>) {
    if (!ref.current) return;

    const rect = ref.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left - rect.width / 2;
    const offsetY = e.clientY - rect.top - rect.height / 2;

    rotateX.set((offsetY / (rect.height / 2)) * -rotateAmplitude);
    rotateY.set((offsetX / (rect.width / 2)) * rotateAmplitude);
  }

  function handleMouseEnter() {
    scale.set(scaleOnHover);
  }

  function handleMouseLeave() {
    scale.set(1);
    rotateX.set(0);
    rotateY.set(0);
  }

  return (
    <Link
      ref={ref}
      href={href}
      className="il-line il-tilted"
      onMouseMove={handleMouse}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ perspective: "900px" }}
    >
      <motion.div
        className="il-tilted__inner"
        style={{
          rotateX,
          rotateY,
          scale,
          transformStyle: "preserve-3d",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt=""
          className="il-line__img"
          style={{ objectPosition }}
          loading="lazy"
          decoding="async"
          aria-hidden
        />
        <div className="il-line__scrim" aria-hidden />
        <span className="il-line__badge" style={{ transform: "translateZ(40px)" }}>
          {badge}
        </span>
        <span className="il-line__cta" aria-hidden style={{ transform: "translateZ(50px)" }}>
          <ArrowRight size={14} />
        </span>
        <div className="il-line__panel" style={{ transform: "translateZ(30px)" }}>
          <h3 className="il-line__name">{name}</h3>
          <p className="il-line__desc">{description}</p>
        </div>
      </motion.div>
    </Link>
  );
}
