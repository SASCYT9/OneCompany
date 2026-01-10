export function formatAutoMessage(p: { name?: string; carModel: string; vin: string; wishes: string; budget: string; email: string; phone?: string; contactMethod?: string; telegramUsername?: string; }) {
  const tgUser = p.telegramUsername ? `\nTelegram User: ${p.telegramUsername}` : '';
  return `Auto Contact\nName: ${p.name || '—'}\nModel: ${p.carModel}\nVIN: ${p.vin || '—'}\nBudget: ${p.budget || '—'}\nWishes: ${p.wishes || '—'}\nEmail: ${p.email}\nPhone: ${p.phone || '—'}\nPreferred contact: ${p.contactMethod || '—'}${tgUser}`;
}

export function formatMotoMessage(p: { name?: string; motoModel: string; vin: string; wishes: string; budget: string; email: string; phone?: string; contactMethod?: string; telegramUsername?: string; }) {
  const tgUser = p.telegramUsername ? `\nTelegram User: ${p.telegramUsername}` : '';
  return `Moto Contact\nName: ${p.name || '—'}\nModel: ${p.motoModel}\nVIN: ${p.vin || '—'}\nBudget: ${p.budget || '—'}\nWishes: ${p.wishes || '—'}\nEmail: ${p.email}\nPhone: ${p.phone || '—'}\nPreferred contact: ${p.contactMethod || '—'}${tgUser}`;
}

export function formatPartnershipMessage(p: { companyName: string; website?: string; type: string; contactName: string; email: string; phone: string; message?: string }) {
  return `<b>Partnership Request</b>\n\n<b>Type:</b> ${p.type}\n<b>Company:</b> ${p.companyName}\n<b>Website:</b> ${p.website || '—'}\n<b>Contact Person:</b> ${p.contactName}\n<b>Email:</b> ${p.email}\n<b>Phone:</b> ${p.phone}\n<b>Message:</b>\n${p.message || '—'}`;
}
