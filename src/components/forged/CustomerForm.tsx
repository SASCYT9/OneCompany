"use client";

import type { SupportedLocale } from "@/lib/seo";
import { useForgedConfig } from "./store";

type Props = { locale: SupportedLocale };

export default function CustomerForm({ locale }: Props) {
  const isUa = locale === "ua";
  const name = useForgedConfig((s) => s.customerName);
  const email = useForgedConfig((s) => s.customerEmail);
  const phone = useForgedConfig((s) => s.customerPhone);
  const note = useForgedConfig((s) => s.config.customerNote);
  const setCustomer = useForgedConfig((s) => s.setCustomer);
  const setConfig = useForgedConfig((s) => s.setConfig);

  return (
    <div className="space-y-3">
      <p className="text-xs uppercase tracking-[0.18em] text-white/40">
        {isUa ? "Контакти для прорахунку" : "Quote contacts"}
      </p>

      <Input
        label={isUa ? "Ім'я" : "Full name"}
        value={name}
        onChange={(v) => setCustomer({ name: v })}
      />
      <Input label="Email" type="email" value={email} onChange={(v) => setCustomer({ email: v })} />
      <Input
        label={isUa ? "Телефон (необов'язково)" : "Phone (optional)"}
        value={phone}
        onChange={(v) => setCustomer({ phone: v })}
      />
      <div>
        <label className="mb-1 block text-xs uppercase tracking-[0.18em] text-white/40">
          {isUa ? "Додаткові побажання" : "Notes (optional)"}
        </label>
        <textarea
          value={note ?? ""}
          rows={3}
          onChange={(e) => setConfig({ customerNote: e.target.value })}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-[#c48e4c]"
          placeholder={
            isUa
              ? "Дедлайн, спеціальний колір, особливі вимоги..."
              : "Deadline, custom colour, special requirements..."
          }
        />
      </div>
    </div>
  );
}

function Input({
  label,
  type = "text",
  value,
  onChange,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs uppercase tracking-[0.18em] text-white/40">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-[#c48e4c]"
      />
    </div>
  );
}
