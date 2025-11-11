'use client';

export function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      {/* Animated background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 via-black to-blue-500/10 animate-gradient-shift" />
        <div 
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 400 400\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' /%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\' /%3E%3C/svg%3E")',
          }}
        />
      </div>

      {/* Loading content */}
      <div className="relative z-10 text-center space-y-8">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 text-5xl md:text-6xl font-thin">
          <span className="text-white/90">one</span>
          <span 
            className="font-light bg-gradient-to-br from-orange-400 via-red-400 to-blue-400 bg-clip-text text-transparent animate-gradient-shift"
            style={{
              filter: 'drop-shadow(0 0 20px rgba(255,136,0,0.4))',
            }}
          >
            company
          </span>
        </div>

        {/* Animated dots */}
        <div className="flex items-center justify-center gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-white/40"
              style={{
                animation: `pulse 1.5s ease-in-out infinite`,
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>

        {/* Loading text */}
        <p className="text-white/40 text-sm tracking-wider uppercase">Завантаження</p>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 0.2;
            transform: scale(0.8);
          }
          50% {
            opacity: 1;
            transform: scale(1.2);
          }
        }
      `}</style>
    </div>
  );
}
