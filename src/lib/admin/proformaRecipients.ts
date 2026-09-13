export const proformaRecipients = [
  {
    id: "recipient-1",
    name: "ФОП Семиноженко Ігор Володимирович",
    legalName: "Фізична особа-підприємець Семиноженко Ігор Володимирович",
    nameEn: "Sole Proprietor Ihor Volodymyrovych Semynozhenko",
    legalNameEn: "Sole Proprietor Ihor Volodymyrovych Semynozhenko",
    bankEn: "UNIVERSAL BANK JSC, bank code 322001",
    available: true,
    iban: "UA883220010000026008310026920",
    code: "3257316796",
    purpose: "",
    bank: 'АТ "УНІВЕРСАЛ БАНК", МФО 322001',
    currency: null,
    swiftBic: "",
    bankAddress: "",
    transferNoteUa: "",
    transferNoteEn: "",
  },
  {
    id: "wise-eur",
    name: "Igor Semynozhenko — Wise · EUR",
    nameEn: "Igor Semynozhenko — Wise · EUR",
    legalName: "Igor Semynozhenko",
    legalNameEn: "Igor Semynozhenko",
    available: true,
    iban: "BE69967315106078",
    code: "",
    purpose: "",
    bank: "Wise",
    bankEn: "Wise",
    currency: "EUR",
    swiftBic: "TRWIBEB1XXX",
    bankAddress: "Rue du Trône 100, 3rd floor, Brussels, 1050, Belgium",
    transferNoteUa: "Використовуйте SWIFT/BIC для переказів з-за меж SEPA.",
    transferNoteEn: "Use SWIFT/BIC when sending money from outside SEPA.",
  },
] as const;
export type ProformaRecipientId = (typeof proformaRecipients)[number]["id"];
export function getProformaRecipient(id: string | null) {
  return proformaRecipients.find((recipient) => recipient.id === id && recipient.available) ?? null;
}

export function localizeProformaRecipient(
  recipient: NonNullable<ReturnType<typeof getProformaRecipient>>,
  locale: "ua" | "en"
) {
  return {
    legalName: locale === "en" ? recipient.legalNameEn : recipient.legalName,
    bank: locale === "en" ? recipient.bankEn : recipient.bank,
    transferNote: locale === "en" ? recipient.transferNoteEn : recipient.transferNoteUa,
  };
}

export function proformaRecipientCurrency(
  recipient: ReturnType<typeof getProformaRecipient>,
  requestedCurrency: string | null,
  orderCurrency: string
) {
  return recipient?.currency || requestedCurrency || orderCurrency;
}
export function localizeProformaCountry(value: string | null | undefined, locale: "ua" | "en") {
  if (locale === "en" && value && /^(україна|украина|ukraine|ua)$/i.test(value.trim()))
    return "Ukraine";
  return value;
}
