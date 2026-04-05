'use client';

import { useScrollReveal } from '@/hooks/useScrollReveal';

type Props = {
  selector: string;
  revealClass: string;
  threshold?: number;
};

export default function ScrollRevealClient({ selector, revealClass, threshold = 0.12 }: Props) {
  useScrollReveal(selector, revealClass, threshold);
  return null;
}
