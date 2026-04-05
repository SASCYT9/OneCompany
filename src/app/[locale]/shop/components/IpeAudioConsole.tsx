'use client';

import { useState, useRef, useEffect } from 'react';
import IpeWaveCanvas from './canvas/IpeWaveCanvas';

export default function IpeAudioConsole() {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Only load audio if explicitly played to save bandwidth
    const a = new Audio('/audio/ipe.mp3');
    a.volume = 0.5;
    a.loop = false;
    audioRef.current = a;

    const handleEnded = () => setIsPlaying(false);
    a.addEventListener('ended', handleEnded);

    return () => {
      a.pause();
      a.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  return (
    <>
      <IpeWaveCanvas isPlaying={isPlaying} />
      
      <div className={`ipe-audio-console ${!isPlaying ? 'paused' : ''}`}>
        <button onClick={togglePlay} className="ipe-btn-play" aria-label="Play Exhaust Sound">
          {isPlaying ? (
            <svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          ) : (
            <svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          )}
        </button>
        <div className="ipe-equalizer">
          <div className="ipe-eq-bar"></div>
          <div className="ipe-eq-bar"></div>
          <div className="ipe-eq-bar"></div>
          <div className="ipe-eq-bar"></div>
          <div className="ipe-eq-bar"></div>
        </div>
      </div>
    </>
  );
}
