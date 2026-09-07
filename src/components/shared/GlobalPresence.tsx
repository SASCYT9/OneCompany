"use client";

import { useEffect, useRef, useState } from "react";

import { getTypography, resolveLocale } from "@/lib/typography";
import styles from "./GlobalPresence.module.css";

const countries = [
  { code: "UA", ua: "Україна", en: "Ukraine", x: 551, y: 112 },
  { code: "PL", ua: "Польща", en: "Poland", x: 518, y: 99 },
  { code: "ES", ua: "Іспанія", en: "Spain", x: 461, y: 141 },
  { code: "SI", ua: "Словенія", en: "Slovenia", x: 503, y: 121 },
  { code: "US", ua: "США", en: "USA", x: 204, y: 149 },
] as const;

const routes = countries.flatMap((from, index) =>
  countries.slice(index + 1).map((to) => {
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    return {
      key: `${from.code}-${to.code}`,
      path: `M ${from.x} ${from.y} Q ${(from.x + to.x) / 2} ${Math.min(from.y, to.y) - Math.max(20, distance * 0.3)} ${to.x} ${to.y}`,
    };
  })
);

export default function GlobalPresence({ locale }: { locale: string }) {
  const [selected, setSelected] = useState(0);
  const [officeOpen, setOfficeOpen] = useState(false);
  const addressRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!officeOpen || !window.matchMedia("(max-width: 1023px)").matches) return;
    const frame = requestAnimationFrame(() => {
      addressRef.current?.scrollIntoView({
        block: "nearest",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [officeOpen]);

  const ua = locale === "ua";
  const typography = getTypography(resolveLocale(locale));
  return (
    <section
      id="global-presence"
      className={styles.presence}
      aria-label={ua ? "Міжнародна присутність OneCompany" : "OneCompany global presence"}
    >
      <h2 className={`${styles.heading} ${typography.h3} font-display font-semibold`}>
        {ua ? "Доставляємо" : "We ship"}
        <br />
        <span>{ua ? "по всьому світу" : "worldwide"}</span>
      </h2>
      <h3 className={styles.officesHeading}>{ua ? "Наші офіси" : "Our offices"}</h3>
      <svg viewBox="150 15 440 205" className={styles.map} aria-hidden="true">
        <defs>
          <radialGradient id="global-map-light">
            <stop offset="0" stopColor="#8dbce5" stopOpacity=".14" />
            <stop offset="1" stopColor="#8dbce5" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="global-map-fade">
            <stop offset=".55" stopColor="white" />
            <stop offset="1" stopColor="black" />
          </radialGradient>
          <mask id="global-map-edges">
            <ellipse cx="370" cy="116" rx="265" ry="140" fill="url(#global-map-fade)" />
          </mask>
          <filter id="global-route-glow" x="-40%" y="-100%" width="180%" height="300%">
            <feGaussianBlur stdDeviation="1.5" />
          </filter>
          <pattern id="global-map-dots" width="4" height="4" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r=".85" fill="currentColor" />
          </pattern>
          <mask id="global-map-mask">
            <image href="/world-map.svg" width="1000" height="556.16" />
          </mask>
        </defs>
        <ellipse cx="440" cy="113" rx="185" ry="105" fill="url(#global-map-light)" />
        <g mask="url(#global-map-edges)">
          <g mask="url(#global-map-mask)">
            <rect width="1000" height="557" fill="currentColor" opacity=".045" />
            <rect width="1000" height="557" fill="url(#global-map-dots)" opacity=".42" />
          </g>
        </g>
        {routes.map(({ key, path }, index) => {
          const motion = {
            animationDelay: `${index * -0.63}s`,
            animationDuration: `${4.5 + (index % 4)}s`,
            animationDirection: "alternate" as const,
          };
          return (
            <g key={key}>
              <path d={path} className={styles.route} />
              <path
                d={path}
                pathLength="100"
                className={styles.flightGlow}
                filter="url(#global-route-glow)"
                style={motion}
              />
              <path d={path} pathLength="100" className={styles.flight} style={motion} />
            </g>
          );
        })}
        {countries.map((point, index) => (
          <g key={point.code} className={index === selected ? styles.active : styles.point}>
            <circle
              cx={point.x}
              cy={point.y}
              r={index === selected ? 11 : 7}
              className={styles.halo}
            />
            <circle
              cx={point.x}
              cy={point.y}
              r="3"
              fill="currentColor"
              stroke="hsl(var(--background))"
              strokeWidth="1"
            />
          </g>
        ))}
      </svg>
      <div
        className={styles.countries}
        role="group"
        aria-label={
          ua ? "Країни, де розташовані наші офіси" : "Countries where our offices are located"
        }
      >
        {countries.map((country, index) => (
          <button
            type="button"
            key={country.code}
            aria-pressed={selected === index}
            aria-expanded={country.code === "UA" ? officeOpen : undefined}
            aria-controls={country.code === "UA" ? "ukraine-office-address" : undefined}
            onClick={() => {
              setSelected(index);
              setOfficeOpen(country.code === "UA" ? !officeOpen : false);
            }}
            onPointerEnter={() => setSelected(index)}
            onFocus={() => setSelected(index)}
          >
            <i />
            {ua ? country.ua : country.en}
          </button>
        ))}
      </div>
      {officeOpen && (
        <div ref={addressRef} id="ukraine-office-address" className={styles.officeAddress}>
          <h3>{ua ? "Київ, Україна" : "Kyiv, Ukraine"}</h3>
          <p>{ua ? "вул. Басейна, 21Б" : "21B Baseina St"}</p>
          <p className={styles.visitNote}>
            {ua
              ? "Особисті візити — лише за попередньою домовленістю."
              : "In-person visits by appointment only."}
          </p>
          <a href="tel:+380660771700">+380 66 077 17 00</a>
        </div>
      )}
    </section>
  );
}
