type BasePayload = {
  vin: string;
  wishes: string;
  budget: string;
  email: string;
};

type AutoPayload = BasePayload & { carModel: string };
type MotoPayload = BasePayload & { motoModel: string };

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatLines(title: string, entries: Array<{ label: string; value?: string }>) {
  const head = `<b>${title}</b>`;
  const body = entries
    .filter((entry) => entry.value && entry.value.trim().length > 0)
    .map((entry) => `• <b>${entry.label}:</b> ${escapeHtml(entry.value!.trim())}`)
    .join('\n');

  return body ? `${head}\n${body}` : head;
}

export function formatAutoMessage(p: AutoPayload) {
  return formatLines('🚗 Auto lead', [
    { label: 'Model', value: p.carModel },
    { label: 'VIN', value: p.vin },
    { label: 'Budget', value: p.budget },
    { label: 'Brief', value: p.wishes },
    { label: 'Email', value: p.email },
  ]);
}

export function formatMotoMessage(p: MotoPayload) {
  return formatLines('🏍 Moto lead', [
    { label: 'Model', value: p.motoModel },
    { label: 'VIN', value: p.vin },
    { label: 'Budget', value: p.budget },
    { label: 'Brief', value: p.wishes },
    { label: 'Email', value: p.email },
  ]);
}
