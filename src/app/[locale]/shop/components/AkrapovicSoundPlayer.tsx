"use client";

import { useRef, useState, useCallback } from "react";
import type { SoundEntry } from "../data/akrapovicSoundData";

type Props = {
  entry: SoundEntry;
  isUa: boolean;
};

export default function AkrapovicSoundPlayer({ entry, isUa }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const toggle = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio(entry.soundUrl);
      audioRef.current.volume = 0.7;
      audioRef.current.addEventListener("ended", () => setIsPlaying(false));
    }

    if (isPlaying) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    } else {
      // Stop any other playing audio on the page
      document
        .querySelectorAll("audio")
        .forEach((a) => {
          a.pause();
          a.currentTime = 0;
        });
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [entry.soundUrl, isPlaying]);

  return (
    <div
      className={`ak-sound-card ${isPlaying ? "ak-sound-card--playing" : ""}`}
      onClick={toggle}
      role="button"
      tabIndex={0}
      aria-label={`Play ${entry.make} ${entry.model} exhaust sound`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      }}
    >
      {/* Image */}
      <div className="ak-sound-card__img-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="ak-sound-card__img"
          src={entry.image}
          alt={`${entry.make} ${entry.model}`}
          loading="lazy"
        />
        {/* Play/Pause button */}
        <div className="ak-sound-card__play">
          {isPlaying ? (
            <svg viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" fill="white" />
              <rect x="14" y="4" width="4" height="16" fill="white" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24">
              <polygon points="6,4 20,12 6,20" />
            </svg>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="ak-sound-card__body">
        <div className="ak-sound-card__make">{entry.make}</div>
        <h3 className="ak-sound-card__model">{entry.model}</h3>
        <p className="ak-sound-card__type">
          {isUa ? entry.exhaustTypeUk : entry.exhaustType}
        </p>
        <div className="ak-sound-card__specs">
          <span className="ak-sound-card__spec">
            <strong>{entry.hpGain}</strong>
          </span>
          <span className="ak-sound-card__spec">
            <strong>{entry.weightSaving}</strong>
          </span>
        </div>
      </div>
    </div>
  );
}
