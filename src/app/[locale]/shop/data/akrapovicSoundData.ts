/* ──────────────────────────────────────────────────
   Akrapovič Sound Comparison Grid Data
   ────────────────────────────────────────────────── */

export type SoundEntry = {
  id: string;
  make: string;
  model: string;
  image: string;
  exhaustType: string;
  exhaustTypeUk: string;
  /** Local sound clip path — keep under 200 KB / 5 sec */
  soundUrl: string;
  /** Power delta from Akrapovic */
  hpGain: string;
  /** Weight saving */
  weightSaving: string;
};

export const AKRAPOVIC_SOUNDS: SoundEntry[] = [
  {
    id: 'bmw-m3-g80',
    make: 'BMW',
    model: 'M3 Competition (G80)',
    image: '/images/shop/akrapovic/sound-bmw-m3.jpg',
    exhaustType: 'Evolution Line (Titanium)',
    exhaustTypeUk: 'Evolution Line (Титан)',
    soundUrl: '/sounds/akrapovic/bmw-m3-evo.mp3',
    hpGain: '+12 HP',
    weightSaving: '-9.8 kg',
  },
  {
    id: 'porsche-911-gt3',
    make: 'Porsche',
    model: '911 GT3 (992)',
    image: '/images/shop/akrapovic/sound-porsche-911-v2.jpg',
    exhaustType: 'Slip-On Race Line',
    exhaustTypeUk: 'Slip-On Race Line',
    soundUrl: '/sounds/akrapovic/porsche-911.mp3',
    hpGain: '+8 HP',
    weightSaving: '-7.2 kg',
  },
  {
    id: 'mercedes-amg-g63',
    make: 'Mercedes-AMG',
    model: 'G 63',
    image: '/images/shop/akrapovic/sound-mercedes-g63-v3.png',
    exhaustType: 'Evolution Line (Titanium)',
    exhaustTypeUk: 'Evolution Line (Титан)',
    soundUrl: '/sounds/akrapovic/mercedes-amg.mp3',
    hpGain: '+15 HP',
    weightSaving: '-12.4 kg',
  },
  {
    id: 'audi-rs6',
    make: 'Audi',
    model: 'RS 6 Avant (C8)',
    image: '/images/shop/akrapovic/sound-audi-rs6-v2.jpg',
    exhaustType: 'Slip-On Line (Titanium)',
    exhaustTypeUk: 'Slip-On Line (Титан)',
    soundUrl: '/sounds/akrapovic/audi-rs6.mp3',
    hpGain: '+10 HP',
    weightSaving: '-8.5 kg',
  },
  {
    id: 'lamborghini-huracan',
    make: 'Lamborghini',
    model: 'Huracán Performante',
    image: '/images/shop/akrapovic/sound-lamborghini.jpg',
    exhaustType: 'Slip-On Line (Titanium)',
    exhaustTypeUk: 'Slip-On Line (Титан)',
    soundUrl: '/sounds/akrapovic/lamborghini.mp3',
    hpGain: '+11 HP',
    weightSaving: '-11.3 kg',
  },
  {
    id: 'ferrari-296',
    make: 'Ferrari',
    model: '296 GTB',
    image: '/images/shop/akrapovic/sound-ferrari.jpg',
    exhaustType: 'Slip-On Line (Titanium)',
    exhaustTypeUk: 'Slip-On Line (Титан)',
    soundUrl: '/sounds/akrapovic/ferrari-296.mp3',
    hpGain: '+9 HP',
    weightSaving: '-10.1 kg',
  },
];
