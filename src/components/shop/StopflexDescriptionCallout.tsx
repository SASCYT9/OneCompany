import Image from "next/image";

type StopflexDescriptionCalloutProps = {
  isUa: boolean;
  isLongFiber: boolean;
};

export function StopflexDescriptionCallout({ isUa, isLongFiber }: StopflexDescriptionCalloutProps) {
  const baseHighlights = isUa
    ? [
        {
          title: "Менша маса",
          description:
            "Ротор CCB подібного розміру може бути суттєво легшим за чавунний; точна різниця залежить від специфікації авто.",
        },
        {
          title: "Стабільність під навантаженням",
          description:
            "C/SiC матеріал розрахований на високотемпературну роботу; допустиме навантаження залежить від версії ротора, колодок та охолодження.",
        },
      ]
    : [
        {
          title: "Lower mass",
          description:
            "A similarly sized CCB rotor can be materially lighter than iron; the exact saving depends on the vehicle specification.",
        },
        {
          title: "Stability under load",
          description:
            "C/SiC material is designed for high-temperature use; the right duty level depends on rotor spec, pads, and cooling.",
        },
      ];
  const finishHighlight = isLongFiber
    ? isUa
      ? {
          title: "Суцільні Long-Fiber волокна",
          description:
            "Довгі карбонові волокна проходять крізь структуру ротора, підвищуючи його міцність і термічну витривалість.",
        }
      : {
          title: "Continuous Long-Fiber strands",
          description:
            "Long carbon strands run through the rotor structure to support strength and thermal durability.",
        }
    : isUa
      ? {
          title: "Без поверхневої іржі",
          description:
            "Керамічна робоча поверхня не вкривається помаранчевим нальотом, характерним для чавунних дисків після вологи.",
        }
      : {
          title: "No flash rust",
          description:
            "The ceramic friction surface does not develop the orange surface rust common to iron discs after exposure to moisture.",
        };
  const highlights = [...baseHighlights, finishHighlight];

  return (
    <section
      aria-labelledby="stopflex-description-title"
      className="relative isolate overflow-hidden rounded-2xl border border-[#e3262b]/30 bg-[#151515] p-5 text-white shadow-lg sm:p-6"
    >
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1 bg-[#e3262b]"
      />
      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex h-11 shrink-0 items-center rounded-lg border border-white/10 bg-white px-3 shadow-sm">
              <Image
                src="/logos/stopflex.png"
                alt=""
                width={334}
                height={102}
                className="h-6 w-auto max-w-[126px] object-contain"
              />
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-red-200/85 sm:text-[10px]">
              {isUa ? "Карбон-керамічна технологія" : "Carbon-ceramic technology"}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {isLongFiber ? (
              <span className="rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/75">
                Long-Fiber
              </span>
            ) : null}
            <span className="rounded-full border border-red-300/25 bg-red-400/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-red-100/90">
              CCB
            </span>
          </div>
        </div>

        <h3
          id="stopflex-description-title"
          className="mt-5 text-balance text-sm font-semibold leading-snug tracking-wide sm:text-base"
        >
          {isUa ? "Більше контролю. Менше зайвої маси." : "More control. Less rotating mass."}
        </h3>
        <p className="mt-2 max-w-3xl text-pretty text-xs leading-relaxed text-white/70 sm:text-sm">
          {isUa
            ? "STOPFLEX CCB поєднує карбон-керамічні ротори із сумісними колодками для впевненої роботи за високої температури. Порівняно з чавунним ротором подібного розміру, CCB може зменшити обертальну й непідресорену масу — точний результат залежить від конфігурації автомобіля."
            : "STOPFLEX CCB pairs carbon-ceramic rotors with compatible pads for confident high-temperature performance. Compared with a similarly sized iron rotor, CCB can reduce rotating and unsprung mass; the exact result depends on the vehicle configuration."}
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {highlights.map((highlight) => (
            <div
              key={highlight.title}
              className="rounded-xl border border-white/[0.08] bg-white/[0.035] p-3"
            >
              <h4 className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/90 sm:text-[10px]">
                {highlight.title}
              </h4>
              <p className="mt-1.5 text-[11px] leading-relaxed text-white/60">
                {highlight.description}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-4 border-t border-white/10 pt-3 text-[10px] leading-relaxed text-white/45">
          {isUa
            ? "Фінальне гальмівне відчуття та ресурс залежать від комплектації, колодок, обкатки й режиму експлуатації. Перед замовленням підтвердьте сумісність і зазор колеса."
            : "Final brake feel and service life depend on vehicle specification, pads, bedding, and use. Confirm fitment and wheel clearance before ordering."}
        </p>
      </div>
    </section>
  );
}
