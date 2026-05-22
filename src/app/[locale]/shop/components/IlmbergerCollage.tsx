"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { IlmbergerGalleryItem } from "../data/ilmbergerHomeData";

type Props = {
  items: ReadonlyArray<IlmbergerGalleryItem>;
  isUa: boolean;
};

/**
 * Cinematic masonry collage with Framer Motion.
 * Uses Shared Layout Animations for a breathtaking, seamless transition
 * from the masonry grid to the fullscreen lightbox.
 */
export default function IlmbergerCollage({ items, isUa }: Props) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  // Handle keyboard events for lightbox
  useEffect(() => {
    if (activeIdx === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveIdx(null);
      if (e.key === "ArrowRight") {
        setActiveIdx((prev) => (prev !== null && prev < items.length - 1 ? prev + 1 : prev));
      }
      if (e.key === "ArrowLeft") {
        setActiveIdx((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIdx, items.length]);

  const currentItem = activeIdx !== null ? items[activeIdx] : null;

  return (
    <>
      <div className="il-collage">
        {items.map((tile, i) => {
          return (
            <motion.figure
              key={tile.id}
              className="il-collage__tile"
              layoutId={`il-gallery-img-${tile.id}`}
              style={{
                gridColumn: `span ${tile.colSpan}`,
                gridRow: `span ${tile.rowSpan}`,
              }}
              whileHover={{
                scale: 0.98,
                transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
              }}
              onClick={() => setActiveIdx(i)}
              role="button"
              tabIndex={0}
              aria-label={isUa ? tile.captionUk : tile.caption}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  setActiveIdx(i);
                }
              }}
            >
              {}
              <motion.img
                src={tile.image}
                alt=""
                loading={i < 4 ? "eager" : "lazy"}
                decoding="async"
                style={{ objectPosition: tile.objectPosition ?? "center" }}
                aria-hidden
                whileHover={{ scale: 1.08 }}
                transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
              />
              <div className="il-collage__scrim" aria-hidden />

              <figcaption className="il-collage__caption">
                <span className="il-collage__caption-num">0{i + 1}</span>
                <span className="il-collage__caption-title">
                  {isUa ? tile.captionUk : tile.caption}
                </span>
              </figcaption>
            </motion.figure>
          );
        })}
      </div>

      {/* Lightbox Portal with AnimatePresence */}
      <AnimatePresence>
        {activeIdx !== null && currentItem && (
          <div className="il-lightbox" onClick={() => setActiveIdx(null)}>
            <motion.div
              className="il-lightbox__backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            />

            <motion.button
              className="il-lightbox__close"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                setActiveIdx(null);
              }}
              aria-label="Close gallery"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.1 }}
            >
              <span className="il-lightbox__close-cross" />
              <span className="il-lightbox__close-txt">CLOSE</span>
            </motion.button>

            {/* Left Arrow */}
            <motion.button
              className={`il-lightbox__arrow il-lightbox__arrow--left ${activeIdx === 0 ? "il-lightbox__arrow--disabled" : ""}`}
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                if (activeIdx > 0) setActiveIdx(activeIdx - 1);
              }}
              disabled={activeIdx === 0}
              aria-label="Previous image"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
            >
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.button>

            {/* Image Container */}
            <div className="il-lightbox__content" style={{ pointerEvents: "none" }}>
              <motion.div
                className="il-lightbox__frame"
                layoutId={`il-gallery-img-${currentItem.id}`}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                style={{ pointerEvents: "auto", touchAction: "none" }}
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                drag
                dragConstraints={{ top: 0, bottom: 0, left: 0, right: 0 }}
                dragElastic={0.7}
                onDragEnd={(e, { offset, velocity }) => {
                  const swipeX = offset.x * velocity.x;
                  const swipeY = offset.y;

                  // Pull up or down to close
                  if (swipeY > 80 || swipeY < -80) {
                    setActiveIdx(null);
                  }
                  // Swipe left/right to navigate
                  else if (swipeX < -2000 && activeIdx < items.length - 1) {
                    setActiveIdx(activeIdx + 1);
                  } else if (swipeX > 2000 && activeIdx > 0) {
                    setActiveIdx(activeIdx - 1);
                  }
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={currentItem.image}
                  alt={isUa ? currentItem.captionUk : currentItem.caption}
                  className="il-lightbox__img"
                />
              </motion.div>

              <motion.div
                className="il-lightbox__meta"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ delay: 0.1 }}
              >
                <div className="il-lightbox__meta-details">
                  <span className="il-lightbox__meta-index">
                    {String(activeIdx + 1).padStart(2, "0")} /{" "}
                    {String(items.length).padStart(2, "0")}
                  </span>
                </div>
                <h4 className="il-lightbox__meta-title">
                  {isUa ? currentItem.captionUk : currentItem.caption}
                </h4>
              </motion.div>
            </div>

            {/* Right Arrow */}
            <motion.button
              className={`il-lightbox__arrow il-lightbox__arrow--right ${activeIdx === items.length - 1 ? "il-lightbox__arrow--disabled" : ""}`}
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                if (activeIdx < items.length - 1) setActiveIdx(activeIdx + 1);
              }}
              disabled={activeIdx === items.length - 1}
              aria-label="Next image"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
            >
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.button>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
