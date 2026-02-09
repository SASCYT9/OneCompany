export default function Loading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        {/* Animated loader */}
        <div className="relative mb-6">
          {/* Outer ring */}
          <div className="w-16 h-16 rounded-full border-2 border-zinc-800" />
          {/* Spinning arc */}
          <div className="absolute inset-0 w-16 h-16 rounded-full border-2 border-transparent border-t-white animate-spin" />
          {/* Inner pulse */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-white animate-pulse" />
          </div>
        </div>

        {/* Text */}
        <p className="text-zinc-500 text-sm animate-pulse">
          Loading...
        </p>
      </div>
    </div>
  );
}
