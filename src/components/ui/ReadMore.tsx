'use client';

import { useState } from 'react';

interface ReadMoreProps {
  children: React.ReactNode;
  labelOpen?: string;
  labelClose?: string;
}

export default function ReadMore({ 
  children, 
  labelOpen = 'Read More', 
  labelClose = 'Show Less' 
}: ReadMoreProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <div className={`relative overflow-hidden transition-all duration-500 ${isOpen ? 'max-h-full' : 'max-h-[120px]'}`}>
        {children}
        
        {!isOpen && (
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white dark:from-black to-transparent" />
        )}
      </div>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="mt-4 flex items-center gap-2 text-xs uppercase tracking-widest text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
      >
        <span>{isOpen ? labelClose : labelOpen}</span>
        <svg 
          className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>
  );
}
