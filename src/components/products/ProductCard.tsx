"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

interface ProductCardProps {
  name: string;
  image: string;
  href: string;
  category?: string;
}

export default function ProductCard({ name, image, href, category }: ProductCardProps) {
  return (
    <Link href={href}>
      <motion.div
        className="group relative overflow-hidden bg-white dark:bg-zinc-900/30 hover:shadow-2xl dark:hover:shadow-white/5 transition-all duration-500"
        whileHover={{ y: -8 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Image Container */}
        <div className="relative aspect-square overflow-hidden bg-zinc-50 dark:bg-zinc-900/50">
          <Image
            src={image}
            alt={name}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
          
          {/* Overlay on Hover */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-500" />
          
          {/* Category Badge */}
          {category && (
            <div className="absolute top-4 left-4 px-3 py-1 bg-white/90 dark:bg-black/90 backdrop-blur-sm">
              <span className="text-xs uppercase tracking-widest font-light text-zinc-900 dark:text-white">
                {category}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          <h3 className="text-lg font-light text-zinc-900 dark:text-white tracking-wide group-hover:text-zinc-600 dark:group-hover:text-white/80 transition-colors duration-300">
            {name}
          </h3>
          
          {/* Animated Underline */}
          <div className="mt-3 h-px bg-zinc-200 dark:bg-white/10 relative overflow-hidden">
            <div className="absolute inset-0 bg-zinc-900 dark:bg-white transform -translate-x-full group-hover:translate-x-0 transition-transform duration-500" />
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
