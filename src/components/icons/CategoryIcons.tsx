// Category-specific SVG icons for automotive components
// Professional, recognizable icons instead of generic Lucide shapes

type IconProps = { className?: string };

// ===== EXHAUST ICONS =====
export const ExhaustSystemIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="10" width="5" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="10" y="10" width="5" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="19" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M8 12H10M15 12H16.5" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

export const MufflerIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="9" width="14" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M8 9V15M11 9V15M14 9V15M17 9V15" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M2 12H5M19 12H22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export const CatIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="8" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="10" cy="12" r="1.5" fill="currentColor"/>
    <circle cx="14" cy="12" r="1.5" fill="currentColor"/>
    <path d="M3 12H6M18 12H21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

// ===== BRAKE ICONS =====
export const BrakeDiscIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M12 4V8M12 16V20M4 12H8M16 12H20" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M7.76 7.76L10.34 10.34M13.66 13.66L16.24 16.24" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

export const CaliperIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 6C8 6 7 6 7 7V17C7 18 8 18 8 18H16C16 18 17 18 17 17V7C17 6 16 6 16 6" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M10 3H14M10 21H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export const BrakeLinesIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 8C4 8 6 6 12 6C18 6 20 8 20 8" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M4 16C4 16 6 18 12 18C18 18 20 16 20 16" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="4" cy="8" r="1.5" fill="currentColor"/>
    <circle cx="20" cy="8" r="1.5" fill="currentColor"/>
  </svg>
);

// ===== SUSPENSION ICONS =====
export const ShockAbsorberIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="10" y="6" width="4" height="12" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M12 3V6M12 18V21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M8 10H16M8 14H16" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

export const CoiloverIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 3V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M9 6H15C16 6 16 7 16 7V17C16 18 15 18 15 18H9C8 18 8 17 8 17V7C8 7 8 6 9 6Z" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M10 9H14M10 12H14M10 15H14" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M12 18V21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export const SwaybарIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 12H8C8 12 9 12 9 13V18M16 12H20C20 12 19 12 19 13V18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="9" cy="19" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="15" cy="19" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M8 12C8 9 10 7 12 7C14 7 16 9 16 12" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

// ===== WHEEL ICONS =====
export const WheelIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="12" cy="12" r="2" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M12 3V9M12 15V21M3 12H9M15 12H21" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M6.34 6.34L9.88 9.88M14.12 14.12L17.66 17.66M6.34 17.66L9.88 14.12M14.12 9.88L17.66 6.34" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

export const TireIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M12 7V9M12 15V17M7 12H9M15 12H17" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

// ===== INTAKE/TURBO ICONS =====
export const TurboIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M12 6C12 6 15 8 15 12C15 16 12 18 12 18M12 18C12 18 9 16 9 12C9 8 12 6 12 6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    <circle cx="12" cy="12" r="2" fill="currentColor"/>
  </svg>
);

export const IntercoolerIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="7" width="16" height="10" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M7 7V17M10 7V17M14 7V17M17 7V17" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M2 12H4M20 12H22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export const AirFilterIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="5" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M9 5V19M12 5V19M15 5V19" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

// ===== EXTERIOR ICONS =====
export const BodyKitIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 12C4 12 6 8 12 8C18 8 20 12 20 12" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M5 14H19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="7" cy="17" r="2" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="17" cy="17" r="2" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

export const SpoilerIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 15L6 12H18L20 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M4 15H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M8 15V18M16 15V18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

// ===== PERFORMANCE/ENGINE ICONS =====
export const EngineIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="8" width="12" height="10" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M9 8V6M12 8V6M15 8V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="10" cy="13" r="1.5" fill="currentColor"/>
    <circle cx="14" cy="13" r="1.5" fill="currentColor"/>
    <path d="M3 12H6M18 12H21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export const ECUIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="7" width="14" height="10" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M9 11H15M9 13H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="15" cy="13" r="0.5" fill="currentColor"/>
    <path d="M12 7V5M12 19V17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

// ===== COOLING ICONS =====
export const RadiatorIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="6" width="14" height="12" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M8 6V18M11 6V18M14 6V18M17 6V18" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M3 12H5M19 12H21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export const WaterPumpIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M12 9V12L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M6 12H4M20 12H18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

// ===== INTERIOR ICONS =====
export const CarbonIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M8 8L16 16M16 8L8 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export const LeatherIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7 9C7 7.34315 8.34315 6 10 6H14C15.6569 6 17 7.34315 17 9V15C17 16.6569 15.6569 18 14 18H10C8.34315 18 7 16.6569 7 15V9Z" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M9 10H15M9 12H15M9 14H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export const AlcantaraIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 3L14 8L19 9L15 13L16 18L12 16L8 18L9 13L5 9L10 8L12 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
  </svg>
);

export const SeatIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 20V10C6 8.89543 6.89543 8 8 8H16C17.1046 8 18 8.89543 18 10V20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M4 20H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="12" cy="5" r="2" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

export const SteeringWheelIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M12 3V9M12 15V21M3 12H9M15 12H21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export const RollCageIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="4" width="16" height="16" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M8 4V20M16 4V20M4 8H20M4 16H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
