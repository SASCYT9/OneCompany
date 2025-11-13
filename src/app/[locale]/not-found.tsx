import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center bg-black text-white">
      <div className="text-center space-y-6 px-6">
        <h1 className="text-5xl font-light">Page not found</h1>
        <p className="text-white/60 font-light max-w-xl">
          This page does not exist. Go back to the homepage or browse categories.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/ua" className="px-5 py-2.5 rounded-full bg-white/10 text-white/90 hover:bg-white/20 transition-colors font-light">Go Home</Link>
          <Link href="/ua/categories" className="px-5 py-2.5 rounded-full bg-white/5 text-white/70 hover:text-white hover:bg-white/10 transition-colors font-light">Categories</Link>
        </div>
      </div>
    </div>
  );
}
