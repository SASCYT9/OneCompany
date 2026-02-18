// src/components/ui/CategoryCard.tsx
import Link from 'next/link';
import Image from 'next/image';

interface CategoryCardProps {
  title: string;
  href: string;
  imageUrl?: string;
}

export default function CategoryCard({ title, href, imageUrl }: CategoryCardProps) {
  return (
    <Link
      href={href}
      aria-label={`Open ${title} tuning brands category`}
      className="group block rounded-lg overflow-hidden relative aspect-w-16 aspect-h-9"
    >
      {imageUrl && (
        <Image
          src={imageUrl}
          alt={title}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
        />
      )}
      <div className="absolute inset-0 bg-black/60 group-hover:bg-black/70 transition-colors" />
      <div className="absolute inset-0 flex items-center justify-center">
        <h3 className="text-2xl font-bold text-white tracking-tight">{title}</h3>
      </div>
    </Link>
  );
}
