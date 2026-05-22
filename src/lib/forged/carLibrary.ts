/**
 * Pre-curated car silhouette library used by the configurator preview.
 *
 * Each entry is a side-on "studio" photograph or rendered silhouette of
 * a popular tuner-target vehicle. The wheelMaskFront / wheelMaskRear
 * coordinates describe the centre and radius of the wheel arch in the
 * source image (units = fraction of image width / height in [0,1]).
 *
 * The preview canvas places a configured wheel render at each mask
 * centre, scaled so the wheel diameter ≈ mask radius × 2.
 *
 * Asset deliverable: drop a 1600×900 photo or rendered silhouette at
 * /public/forged/cars/<slug>.jpg for each entry. Images are not bundled
 * with this MVP — they are content the brand team supplies before launch.
 */

export type CarLibraryEntry = {
  slug: string;
  make: string;
  model: string;
  /** Year range — purely informational, not used for matching. */
  years: string;
  photoUrl: string;
  /** Wheel centre (x, y) and radius in normalised image coordinates. */
  wheelMaskFront: { x: number; y: number; r: number };
  wheelMaskRear: { x: number; y: number; r: number };
};

/**
 * Coordinates below are starting placeholders. Adjust per real photo
 * (open the image in any image-coordinate tool, sample the centre of
 * each wheel arch, divide by image dimensions). The configurator UI
 * will read these as-is.
 */
export const CAR_LIBRARY: CarLibraryEntry[] = [
  {
    slug: "bmw-m3-g80",
    make: "BMW",
    model: "M3 (G80)",
    years: "2021—",
    photoUrl: "/forged/cars/bmw-m3-g80.jpg",
    wheelMaskFront: { x: 0.235, y: 0.66, r: 0.085 },
    wheelMaskRear: { x: 0.795, y: 0.66, r: 0.085 },
  },
  {
    slug: "bmw-m4-g82",
    make: "BMW",
    model: "M4 (G82)",
    years: "2021—",
    photoUrl: "/forged/cars/bmw-m4-g82.jpg",
    wheelMaskFront: { x: 0.23, y: 0.66, r: 0.084 },
    wheelMaskRear: { x: 0.79, y: 0.66, r: 0.084 },
  },
  {
    slug: "bmw-m2-g87",
    make: "BMW",
    model: "M2 (G87)",
    years: "2023—",
    photoUrl: "/forged/cars/bmw-m2-g87.jpg",
    wheelMaskFront: { x: 0.24, y: 0.66, r: 0.082 },
    wheelMaskRear: { x: 0.78, y: 0.66, r: 0.082 },
  },
  {
    slug: "bmw-m5-g90",
    make: "BMW",
    model: "M5 (G90)",
    years: "2024—",
    photoUrl: "/forged/cars/bmw-m5-g90.jpg",
    wheelMaskFront: { x: 0.225, y: 0.665, r: 0.082 },
    wheelMaskRear: { x: 0.8, y: 0.665, r: 0.082 },
  },
  {
    slug: "bmw-m5-f90",
    make: "BMW",
    model: "M5 (F90)",
    years: "2018—2023",
    photoUrl: "/forged/cars/bmw-m5-f90.jpg",
    wheelMaskFront: { x: 0.225, y: 0.665, r: 0.083 },
    wheelMaskRear: { x: 0.8, y: 0.665, r: 0.083 },
  },
  {
    slug: "bmw-m760-g70",
    make: "BMW",
    model: "M760e / 7 Series (G70)",
    years: "2022—",
    photoUrl: "/forged/cars/bmw-m760-g70.jpg",
    wheelMaskFront: { x: 0.23, y: 0.66, r: 0.086 },
    wheelMaskRear: { x: 0.805, y: 0.66, r: 0.086 },
  },
  {
    slug: "porsche-992-gt3",
    make: "Porsche",
    model: "911 GT3 (992)",
    years: "2021—",
    photoUrl: "/forged/cars/porsche-992-gt3.jpg",
    wheelMaskFront: { x: 0.21, y: 0.66, r: 0.092 },
    wheelMaskRear: { x: 0.81, y: 0.66, r: 0.092 },
  },
  {
    slug: "porsche-992-turbo",
    make: "Porsche",
    model: "911 Turbo S (992)",
    years: "2020—",
    photoUrl: "/forged/cars/porsche-992-turbo.jpg",
    wheelMaskFront: { x: 0.215, y: 0.66, r: 0.09 },
    wheelMaskRear: { x: 0.81, y: 0.66, r: 0.09 },
  },
  {
    slug: "porsche-cayenne-turbo",
    make: "Porsche",
    model: "Cayenne Turbo GT",
    years: "2021—",
    photoUrl: "/forged/cars/porsche-cayenne-turbo.jpg",
    wheelMaskFront: { x: 0.24, y: 0.62, r: 0.105 },
    wheelMaskRear: { x: 0.79, y: 0.62, r: 0.105 },
  },
  {
    slug: "audi-rs6-c8",
    make: "Audi",
    model: "RS6 Avant (C8)",
    years: "2020—",
    photoUrl: "/forged/cars/audi-rs6-c8.jpg",
    wheelMaskFront: { x: 0.225, y: 0.65, r: 0.088 },
    wheelMaskRear: { x: 0.8, y: 0.65, r: 0.088 },
  },
  {
    slug: "audi-rs3-8y",
    make: "Audi",
    model: "RS3 (8Y)",
    years: "2022—",
    photoUrl: "/forged/cars/audi-rs3-8y.jpg",
    wheelMaskFront: { x: 0.235, y: 0.66, r: 0.082 },
    wheelMaskRear: { x: 0.79, y: 0.66, r: 0.082 },
  },
  {
    slug: "audi-r8-gen2",
    make: "Audi",
    model: "R8 (Gen 2)",
    years: "2015—2024",
    photoUrl: "/forged/cars/audi-r8-gen2.jpg",
    wheelMaskFront: { x: 0.21, y: 0.66, r: 0.088 },
    wheelMaskRear: { x: 0.815, y: 0.66, r: 0.088 },
  },
  {
    slug: "audi-rsq8",
    make: "Audi",
    model: "RS Q8",
    years: "2020—",
    photoUrl: "/forged/cars/audi-rsq8.jpg",
    wheelMaskFront: { x: 0.235, y: 0.61, r: 0.108 },
    wheelMaskRear: { x: 0.795, y: 0.61, r: 0.108 },
  },
  {
    slug: "mercedes-c63-w206",
    make: "Mercedes-AMG",
    model: "C63 (W206)",
    years: "2023—",
    photoUrl: "/forged/cars/mercedes-c63-w206.jpg",
    wheelMaskFront: { x: 0.235, y: 0.66, r: 0.082 },
    wheelMaskRear: { x: 0.79, y: 0.66, r: 0.082 },
  },
  {
    slug: "mercedes-g63-w465",
    make: "Mercedes-AMG",
    model: "G63 (W465)",
    years: "2024—",
    photoUrl: "/forged/cars/mercedes-g63-w465.jpg",
    wheelMaskFront: { x: 0.225, y: 0.6, r: 0.108 },
    wheelMaskRear: { x: 0.8, y: 0.6, r: 0.108 },
  },
  {
    slug: "mercedes-gt63-w296",
    make: "Mercedes-AMG",
    model: "GT 63 (W296)",
    years: "2024—",
    photoUrl: "/forged/cars/mercedes-gt63-w296.jpg",
    wheelMaskFront: { x: 0.21, y: 0.66, r: 0.088 },
    wheelMaskRear: { x: 0.81, y: 0.66, r: 0.088 },
  },
  {
    slug: "mercedes-s580-w223",
    make: "Mercedes-Benz",
    model: "S580 (W223)",
    years: "2021—",
    photoUrl: "/forged/cars/mercedes-s580-w223.jpg",
    wheelMaskFront: { x: 0.23, y: 0.66, r: 0.086 },
    wheelMaskRear: { x: 0.805, y: 0.66, r: 0.086 },
  },
  {
    slug: "tesla-model-3-highland",
    make: "Tesla",
    model: "Model 3 (Highland)",
    years: "2024—",
    photoUrl: "/forged/cars/tesla-model-3-highland.jpg",
    wheelMaskFront: { x: 0.235, y: 0.665, r: 0.082 },
    wheelMaskRear: { x: 0.79, y: 0.665, r: 0.082 },
  },
  {
    slug: "tesla-model-y",
    make: "Tesla",
    model: "Model Y",
    years: "2020—",
    photoUrl: "/forged/cars/tesla-model-y.jpg",
    wheelMaskFront: { x: 0.235, y: 0.65, r: 0.092 },
    wheelMaskRear: { x: 0.79, y: 0.65, r: 0.092 },
  },
  {
    slug: "tesla-model-s-plaid",
    make: "Tesla",
    model: "Model S Plaid",
    years: "2021—",
    photoUrl: "/forged/cars/tesla-model-s-plaid.jpg",
    wheelMaskFront: { x: 0.215, y: 0.665, r: 0.084 },
    wheelMaskRear: { x: 0.8, y: 0.665, r: 0.084 },
  },
  {
    slug: "vw-golf-r-mk8",
    make: "Volkswagen",
    model: "Golf R (Mk8)",
    years: "2021—",
    photoUrl: "/forged/cars/vw-golf-r-mk8.jpg",
    wheelMaskFront: { x: 0.235, y: 0.66, r: 0.082 },
    wheelMaskRear: { x: 0.79, y: 0.66, r: 0.082 },
  },
  {
    slug: "lamborghini-urus",
    make: "Lamborghini",
    model: "Urus",
    years: "2018—",
    photoUrl: "/forged/cars/lamborghini-urus.jpg",
    wheelMaskFront: { x: 0.235, y: 0.6, r: 0.105 },
    wheelMaskRear: { x: 0.79, y: 0.6, r: 0.105 },
  },
  {
    slug: "range-rover-sport-l461",
    make: "Land Rover",
    model: "Range Rover Sport (L461)",
    years: "2022—",
    photoUrl: "/forged/cars/range-rover-sport-l461.jpg",
    wheelMaskFront: { x: 0.235, y: 0.6, r: 0.108 },
    wheelMaskRear: { x: 0.795, y: 0.6, r: 0.108 },
  },
  {
    slug: "honda-civic-type-r-fl5",
    make: "Honda",
    model: "Civic Type R (FL5)",
    years: "2023—",
    photoUrl: "/forged/cars/honda-civic-type-r-fl5.jpg",
    wheelMaskFront: { x: 0.235, y: 0.66, r: 0.082 },
    wheelMaskRear: { x: 0.79, y: 0.66, r: 0.082 },
  },
  {
    slug: "nissan-gt-r-r35",
    make: "Nissan",
    model: "GT-R (R35)",
    years: "2009—2024",
    photoUrl: "/forged/cars/nissan-gt-r-r35.jpg",
    wheelMaskFront: { x: 0.235, y: 0.66, r: 0.085 },
    wheelMaskRear: { x: 0.79, y: 0.66, r: 0.085 },
  },
  {
    slug: "toyota-supra-a90",
    make: "Toyota",
    model: "GR Supra (A90)",
    years: "2020—",
    photoUrl: "/forged/cars/toyota-supra-a90.jpg",
    wheelMaskFront: { x: 0.24, y: 0.66, r: 0.084 },
    wheelMaskRear: { x: 0.79, y: 0.66, r: 0.084 },
  },
];

export function findCarBySlug(slug: string): CarLibraryEntry | undefined {
  return CAR_LIBRARY.find((c) => c.slug === slug);
}
