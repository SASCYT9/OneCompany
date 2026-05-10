import { escapeHtml } from "@/lib/telegramNotifications";

type ContactPayload = {
  name?: string;
  vin?: string;
  wishes?: string;
  budget?: string;
  email: string;
  phone?: string;
  contactMethod?: string;
  telegramUsername?: string;
};

type AutoPayload = ContactPayload & { carModel: string };
type MotoPayload = ContactPayload & { motoModel: string };

const CONTACT_METHOD_LABEL: Record<string, string> = {
  telegram: "Telegram",
  whatsapp: "WhatsApp",
};

function formatTelegramHandle(raw?: string): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/^@+/, "");
  return cleaned ? `@${cleaned}` : null;
}

function formatContactBody(p: {
  emoji: string;
  title: string;
  modelLabel: string;
  modelValue: string;
  vin?: string;
  budget?: string;
  email: string;
  phone?: string;
  telegramUsername?: string;
  contactMethod?: string;
  wishes?: string;
}): string {
  const lines: string[] = [];

  lines.push(`${p.emoji} <b>${p.title}</b>`);
  lines.push("");

  // Vehicle details
  lines.push(`<b>${p.modelLabel}:</b> ${escapeHtml(p.modelValue)}`);
  if (p.vin) lines.push(`<b>VIN:</b> <code>${escapeHtml(p.vin)}</code>`);
  if (p.budget) lines.push(`<b>Budget:</b> ${escapeHtml(p.budget)}`);

  // Contact details
  lines.push("");
  lines.push(`<b>Email:</b> ${escapeHtml(p.email)}`);
  if (p.phone) lines.push(`<b>Phone:</b> ${escapeHtml(p.phone)}`);
  const handle = formatTelegramHandle(p.telegramUsername);
  if (handle) lines.push(`<b>Telegram:</b> ${escapeHtml(handle)}`);
  if (p.contactMethod) {
    const label = CONTACT_METHOD_LABEL[p.contactMethod] ?? p.contactMethod;
    lines.push(`<b>Preferred contact:</b> ${escapeHtml(label)}`);
  }

  // User message
  if (p.wishes) {
    lines.push("");
    lines.push("<b>Message:</b>");
    lines.push(escapeHtml(p.wishes));
  }

  return lines.join("\n");
}

export function formatAutoMessage(p: AutoPayload): string {
  return formatContactBody({
    emoji: "🚗",
    title: "New Auto Inquiry",
    modelLabel: "Model",
    modelValue: p.carModel,
    vin: p.vin,
    budget: p.budget,
    email: p.email,
    phone: p.phone,
    telegramUsername: p.telegramUsername,
    contactMethod: p.contactMethod,
    wishes: p.wishes,
  });
}

export function formatMotoMessage(p: MotoPayload): string {
  return formatContactBody({
    emoji: "🏍",
    title: "New Moto Inquiry",
    modelLabel: "Model",
    modelValue: p.motoModel,
    vin: p.vin,
    budget: p.budget,
    email: p.email,
    phone: p.phone,
    telegramUsername: p.telegramUsername,
    contactMethod: p.contactMethod,
    wishes: p.wishes,
  });
}

export function formatPartnershipMessage(p: {
  companyName: string;
  website?: string;
  type: string;
  contactName: string;
  email: string;
  phone: string;
  message?: string;
}): string {
  const lines: string[] = [];
  lines.push("🤝 <b>Partnership Request</b>");
  lines.push("");
  lines.push(`<b>Type:</b> ${escapeHtml(p.type)}`);
  lines.push(`<b>Company:</b> ${escapeHtml(p.companyName)}`);
  if (p.website) lines.push(`<b>Website:</b> ${escapeHtml(p.website)}`);
  lines.push("");
  lines.push(`<b>Contact:</b> ${escapeHtml(p.contactName)}`);
  lines.push(`<b>Email:</b> ${escapeHtml(p.email)}`);
  lines.push(`<b>Phone:</b> ${escapeHtml(p.phone)}`);
  if (p.message) {
    lines.push("");
    lines.push("<b>Message:</b>");
    lines.push(escapeHtml(p.message));
  }
  return lines.join("\n");
}
