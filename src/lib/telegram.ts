export function formatAutoMessage(p: { name?: string; carModel: string; vin: string; wishes: string; budget: string; email: string; phone?: string; contactMethod?: string; }) {
  return `Auto Contact\nName: ${p.name || '—'}\nModel: ${p.carModel}\nVIN: ${p.vin || '—'}\nBudget: ${p.budget || '—'}\nWishes: ${p.wishes || '—'}\nEmail: ${p.email}\nPhone: ${p.phone || '—'}\nPreferred contact: ${p.contactMethod || '—'}`;
}

export function formatMotoMessage(p: { name?: string; motoModel: string; vin: string; wishes: string; budget: string; email: string; phone?: string; contactMethod?: string; }) {
  return `Moto Contact\nName: ${p.name || '—'}\nModel: ${p.motoModel}\nVIN: ${p.vin || '—'}\nBudget: ${p.budget || '—'}\nWishes: ${p.wishes || '—'}\nEmail: ${p.email}\nPhone: ${p.phone || '—'}\nPreferred contact: ${p.contactMethod || '—'}`;
}
