"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { useState, useEffect } from "react";
import { shouldInvertBrand } from "@/lib/invertBrands";

interface Brand {
  name: string;
  logo: string;
}

interface BrandCarouselProps {
  brands: Brand[];
  direction?: "left" | "right";
  speed?: number;
  title?: string;
}

export default function BrandCarousel({ 
  brands, 
  direction = "left", 
  speed = 40,
  title 
}: BrandCarouselProps) {
  const [duplicatedBrands, setDuplicatedBrands] = useState<Brand[]>([]);

  useEffect(() => {
    // Duplicate brands multiple times for seamless infinite scroll
    const duplicates = [...brands, ...brands, ...brands, ...brands];
    setDuplicatedBrands(duplicates);
  }, [brands]);

  const animationDirection = direction === "left" ? -1 : 1;

  return (
    <div className="w-full overflow-hidden">
      {title && (
        <h3 className="text-xl font-light text-zinc-900 dark:text-white mb-8 uppercase tracking-widest">
          {title}
        </h3>
      )}
      
      <div className="relative group">
  {/* Gradient Overlays */}
  <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-white dark:from-black to-transparent z-10 pointer-events-none" />
  <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-white dark:from-black to-transparent z-10 pointer-events-none" />
        
        <motion.div
          className="flex gap-6"
          animate={{
            x: animationDirection * -50 + "%",
          }}
          transition={{
            x: {
              repeat: Infinity,
              repeatType: "loop",
              duration: speed,
              ease: "linear",
            },
          }}
          style={{
            width: "fit-content",
          }}
        >
          {duplicatedBrands.map((brand, index) => (
            <motion.div
              key={`${brand.name}-${index}`}
              className="flex-shrink-0 w-48 h-32 border border-zinc-900/10 dark:border-white/10 hover:border-zinc-900/30 dark:hover:border-white/30 transition-all duration-300 p-6 flex items-center justify-center bg-zinc-100/50 dark:bg-zinc-950/50 backdrop-blur-sm relative overflow-hidden group/card"
              whileHover={{ 
                scale: 1.05,
                transition: { duration: 0.2 }
              }}
            >
              {/* Shine effect on hover */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/5 to-transparent translate-x-[-200%] group-hover/card:translate-x-[200%] transition-transform duration-700 dark:via-white/5" />
              
              <Image
                src={brand.logo}
                alt={brand.name}
                width={140}
                height={70}
                className={`object-contain opacity-80 group-hover/card:opacity-100 transition-opacity duration-300 relative z-10 ${shouldInvertBrand(brand.name) ? 'filter brightness-0 invert' : ''}`}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
