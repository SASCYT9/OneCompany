"use client";

import { useState } from "react";
import Link from "next/link";
import "../_shared/palettes.css";
import "./theme-lab.css";
import { PALETTES, DEFAULT_PALETTE, type PaletteId } from "../_shared/palettes";
import PaletteSwitcher from "../_shared/PaletteSwitcher";

export default function ThemeLabClient() {
  const [palette, setPalette] = useState<PaletteId>(DEFAULT_PALETTE);
  const active = PALETTES.find((p) => p.id === palette)!;

  return (
    <div className="theme-lab" data-palette={palette}>
      <header className="lab-toolbar">
        <div className="lab-toolbar__brand">
          <span className="lab-logo">ONE</span>
          <span className="lab-toolbar__title">Theme Lab</span>
          <span className="lab-toolbar__hint">Phase 0 · палітра-санд-бокс</span>
        </div>
        <div className="lab-toolbar__actions">
          <Link href="/dev/shop-preview" className="lab-toolbar__link">
            Shop Preview →
          </Link>
          <PaletteSwitcher value={palette} onChange={setPalette} />
        </div>
      </header>

      <div className="lab-banner">
        <strong>{active.name}.</strong> {active.description}
        <span className="lab-banner__inspo">— inspiration: {active.inspiration}</span>
      </div>

      <main className="lab-stage">
        <section className="lab-hero">
          <div className="lab-hero__eyebrow">PREMIUM TUNING · WORLDWIDE</div>
          <h1 className="lab-hero__title">
            Performance, <em>refined.</em>
          </h1>
          <p className="lab-hero__sub">
            Akrapovic, Brabus, Mansory, HRE, KW, Öhlins. Офіційний дистриб&apos;ютор 200+
            преміум-брендів тюнінгу з доставкою в Україну, ЄС та США.
          </p>
          <div className="lab-hero__cta">
            <a className="btn-bronze">Каталог</a>
            <a className="btn-ghost">Дізнатись більше</a>
          </div>
          <div className="lab-stats">
            <div className="lab-stat">
              <span className="lab-stat__value">200+</span>
              <span className="lab-stat__label">brands</span>
            </div>
            <div className="lab-stat">
              <span className="lab-stat__value">50K+</span>
              <span className="lab-stat__label">SKUs</span>
            </div>
            <div className="lab-stat">
              <span className="lab-stat__value">14d</span>
              <span className="lab-stat__label">avg. shipping</span>
            </div>
          </div>
        </section>

        <section className="lab-block">
          <h2 className="lab-block__heading">Typography</h2>
          <div className="lab-type-grid">
            <div>
              <h1 className="lab-h1">Heading 1 — Hero</h1>
              <h2 className="lab-h2">Heading 2 — Section</h2>
              <h3 className="lab-h3">Heading 3 — Subsection</h3>
              <h4 className="lab-h4">Heading 4 — Card title</h4>
            </div>
            <div>
              <p className="lab-body">
                Body text. Цей абзац показує, як читається базовий текст на обраній палітрі.
                <a href="#" className="lab-link">
                  {" "}
                  Посилання
                </a>{" "}
                має достатній контраст,
                <span className="lab-muted"> приглушений текст</span> — нижчий, але читабельний.
              </p>
              <p className="lab-small">Small / metadata — 12px, uppercase tracking</p>
              <p className="lab-mono">price: 1 280 USD · sku: AKR-EVO-X-FULL · in stock</p>
            </div>
          </div>
        </section>

        <section className="lab-block">
          <h2 className="lab-block__heading">Buttons</h2>
          <div className="lab-row">
            <button className="btn-bronze">Primary CTA</button>
            <button className="btn-ghost">Ghost</button>
            <button className="btn-outline">Outline</button>
            <button className="btn-bronze" disabled>
              Disabled
            </button>
          </div>
        </section>

        <section className="lab-block">
          <h2 className="lab-block__heading">Product cards</h2>
          <div className="lab-card-grid">
            {[1, 2, 3].map((i) => (
              <article key={i} className="product-card-premium">
                <div className="product-card__media" aria-hidden />
                <div className="product-card__body">
                  <div className="product-card__brand">AKRAPOVIC</div>
                  <h3 className="product-card__title">Evolution Line Titanium</h3>
                  <div className="product-card__meta">BMW M3/M4 · G80/G82</div>
                  <div className="product-card__foot">
                    <span className="product-card__price">€ 4 850</span>
                    <span className="product-card__pill">In stock</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="lab-block">
          <h2 className="lab-block__heading">Surfaces & glass</h2>
          <div className="lab-surface-grid">
            <div className="lab-surface" data-tone="background">
              background
            </div>
            <div className="lab-surface" data-tone="card">
              card
            </div>
            <div className="lab-surface" data-tone="muted">
              muted
            </div>
            <div className="lab-surface" data-tone="elevated">
              elevated
            </div>
            <div className="glass-panel">glass-panel</div>
            <div className="lab-surface" data-tone="primary">
              primary
            </div>
          </div>
        </section>

        <section className="lab-block">
          <h2 className="lab-block__heading">Form</h2>
          <div className="lab-form">
            <label className="lab-field">
              <span>Email</span>
              <input type="email" placeholder="you@onecompany.com" defaultValue="" />
            </label>
            <label className="lab-field">
              <span>Повідомлення</span>
              <textarea rows={3} placeholder="Хочу дізнатись про доступність..." />
            </label>
            <div className="lab-row">
              <button className="btn-bronze">Надіслати</button>
              <button className="btn-ghost">Скасувати</button>
            </div>
          </div>
        </section>

        <section className="lab-block">
          <h2 className="lab-block__heading">Color tokens</h2>
          <div className="lab-swatch-grid">
            {[
              "background",
              "foreground",
              "card",
              "card-foreground",
              "muted",
              "muted-foreground",
              "primary",
              "primary-foreground",
              "secondary",
              "secondary-foreground",
              "accent",
              "accent-foreground",
              "border",
              "destructive",
            ].map((token) => (
              <div key={token} className="lab-swatch">
                <div className="lab-swatch__chip" data-token={token} />
                <div className="lab-swatch__label">{token}</div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="lab-foot">
        <Link href="/dev/shop-preview" className="lab-foot__cta">
          → Подивитись як це виглядає на справжньому магазині (Shop Preview)
        </Link>
        <p>
          Перемикайся між палітрами вгорі. Коли визначишся — скажи яка, і я зафіксую її в{" "}
          <code>globals.css</code>.
        </p>
      </footer>
    </div>
  );
}
