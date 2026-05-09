"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import type { SoundEntry } from "../data/akrapovicSoundData";

type Props = {
  entry: SoundEntry;
  isUa: boolean;
};

export default function AkrapovicSoundPlayer({ entry, isUa }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Canvas Drawing Loop
  const drawVisualizer = useCallback(() => {
    if (!analyserRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext("2d");
    if (!canvasCtx) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i]; // Value 0-255

        // Create a titanium/white gradient (cold industrial)
        const intensity = dataArray[i] / 255;
        const r = 140 + 115 * intensity;
        const g = 150 + 105 * intensity;
        const b = 160 + 95 * intensity;

        canvasCtx.fillStyle = `rgba(${r},${g},${b},${0.3 + intensity * 0.5})`;

        // Draw bars from bottom up
        canvasCtx.fillRect(x, canvas.height - barHeight / 2, barWidth, barHeight / 2);
        x += barWidth + 1;
      }
    };

    draw();
  }, []);

  const initAudioEngine = useCallback(() => {
    if (audioCtxRef.current) return; // Already initialized

    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    const audioCtx = new AudioContext();
    const analyser = audioCtx.createAnalyser();

    audioCtxRef.current = audioCtx;
    analyserRef.current = analyser;

    // Smoothness and bar count
    analyser.smoothingTimeConstant = 0.85;
    analyser.fftSize = 128; // Reduced for chunkier, aggressive exhaust bars

    if (audioRef.current) {
      const source = audioCtx.createMediaElementSource(audioRef.current);
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
    }
  }, []);

  const toggle = useCallback(() => {
    setHasInteracted(true);

    if (!audioRef.current) {
      const audio = new Audio(entry.soundUrl);
      audio.crossOrigin = "anonymous";
      audio.volume = 0.7;
      audio.addEventListener("ended", () => {
        setIsPlaying(false);
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      });
      audioRef.current = audio;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    } else {
      // Stop other players
      document.querySelectorAll("audio").forEach((a) => {
        a.pause();
      });

      initAudioEngine();
      if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume();
      }

      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          drawVisualizer();
        })
        .catch(() => {
          // Browsers can block autoplay; UI stays paused, user can retry.
        });
    }
  }, [entry.soundUrl, isPlaying, initAudioEngine, drawVisualizer]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  return (
    <div
      className={`ak-sound-card ${isPlaying ? "ak-sound-card--playing" : ""} overflow-hidden group border border-white/5 bg-[#080808] transition-colors duration-500 hover:border-white/15 rounded-sm relative`}
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
      {/* Image Wrap */}
      <div className="ak-sound-card__img-wrap relative w-full aspect-4/3 bg-black overflow-hidden flex items-center justify-center p-4">
        {/* Background glow when playing */}
        <div
          className={`absolute inset-0 bg-white/5 transition-opacity duration-1000 mix-blend-screen pointer-events-none ${isPlaying ? "opacity-100" : "opacity-0"}`}
        ></div>

        {/* Visualizer Canvas overlay */}
        <canvas
          ref={canvasRef}
          width={300}
          height={150}
          className={`absolute bottom-0 left-0 w-full h-[60%] pointer-events-none transition-opacity duration-300 z-10 opacity-70 mix-blend-screen ${isPlaying ? "opacity-100" : "opacity-0"}`}
        />

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="ak-sound-card__img w-full h-full object-contain filter group-hover:brightness-110 transition-all duration-700 relative z-0"
          src={entry.image}
          alt={`${entry.make} ${entry.model}`}
          loading="lazy"
        />

        {/* Play/Pause button */}
        <div
          className={`absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/10 transition-all duration-300 z-20 ${isPlaying ? "bg-transparent group-hover:bg-black/5" : ""}`}
        >
          <div
            className={`w-14 h-14 rounded-full flex items-center justify-center backdrop-blur-xl border transition-all duration-500 ${isPlaying ? "scale-75 opacity-20 bg-white/10 border-white/10" : "bg-black/50 border-white/15 group-hover:scale-110 group-hover:border-white/30 group-hover:shadow-[0_0_30px_rgba(255,255,255,0.12)] opacity-90"}`}
          >
            {isPlaying ? (
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-white">
                <rect x="6" y="4" width="4" height="16" fill="currentColor" />
                <rect x="14" y="4" width="4" height="16" fill="currentColor" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="w-6 h-6 ml-0.5 text-white/90">
                <polygon points="6,4 20,12 6,20" fill="currentColor" />
              </svg>
            )}
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="ak-sound-card__body p-5 relative z-30 bg-[#080808]">
        <div className="ak-sound-card__make text-[9px] uppercase tracking-[0.3em] font-light text-zinc-500 mb-1">
          {entry.make}
        </div>
        <h3 className="ak-sound-card__model text-lg font-medium text-white mb-1 group-hover:text-zinc-300 transition-colors">
          {entry.model}
        </h3>
        <p className="ak-sound-card__type text-xs font-light text-zinc-400 mb-5">
          {isUa ? entry.exhaustTypeUk : entry.exhaustType}
        </p>
      </div>
    </div>
  );
}
