export function formatAutoMessage(p: { carModel: string; vin: string; wishes: string; budget: string; email: string; }) {
  return `Auto Contact\nModel: ${p.carModel}\nVIN: ${p.vin}\nBudget: ${p.budget}\nWishes: ${p.wishes}\nEmail: ${p.email}`;
}

export function formatMotoMessage(p: { motoModel: string; vin: string; wishes: string; budget: string; email: string; }) {
  return `Moto Contact\nModel: ${p.motoModel}\nVIN: ${p.vin}\nBudget: ${p.budget}\nWishes: ${p.wishes}\nEmail: ${p.email}`;
}
