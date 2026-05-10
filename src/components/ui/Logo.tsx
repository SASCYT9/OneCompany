import Link from "next/link";
import clsx from "clsx";

type LogoSize = "default" | "compact";

type LogoProps = {
  className?: string;
  asLink?: boolean;
  priority?: boolean;
  /** "auto" (default) flips per theme; "dark"/"light" force a single variant. */
  tone?: "dark" | "light" | "auto";
  size?: LogoSize;
};

const LOGO_DARK = "/branding/logo-dark.svg";
const LOGO_LIGHT = "/branding/logo-light.svg";
const LOGO_DIMENSIONS: Record<LogoSize, { width: number; height: number }> = {
  default: { width: 212, height: 78 },
  compact: { width: 168, height: 62 },
};

const ALT =
  "OneCompany - преміум тюнінг авто мото Київ Україна, офіційний дилер Akrapovic Brabus Mansory";

export function Logo({
  className = "",
  asLink = false,
  priority = false,
  tone = "auto",
  size = "default",
}: LogoProps) {
  const { width, height } = LOGO_DIMENSIONS[size];

  let inner: React.ReactNode;
  if (tone === "auto") {
    // Render both variants, toggle via `dark:` / no-prefix (light) classes.
    inner = (
      <>
        <img
          src={LOGO_DARK}
          alt={ALT}
          width={width}
          height={height}
          loading={priority ? "eager" : "lazy"}
          className="h-auto w-full block dark:hidden"
        />
        <img
          src={LOGO_LIGHT}
          alt=""
          aria-hidden="true"
          width={width}
          height={height}
          loading={priority ? "eager" : "lazy"}
          className="h-auto w-full hidden dark:block"
        />
      </>
    );
  } else {
    const logoSrc = tone === "light" ? LOGO_LIGHT : LOGO_DARK;
    inner = (
      <img
        src={logoSrc}
        alt={ALT}
        width={width}
        height={height}
        loading={priority ? "eager" : "lazy"}
        className="h-auto w-full"
      />
    );
  }

  const image = <span className={clsx("inline-flex items-center", className)}>{inner}</span>;

  if (asLink) {
    return (
      <Link
        href="/"
        className="inline-flex items-center focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white/40"
        aria-label="ONE COMPANY home"
      >
        {image}
      </Link>
    );
  }

  return image;
}

export default Logo;
