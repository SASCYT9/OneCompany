export const proformaRecipients = [
  {
    id: "recipient-1",
    name: "ФОП Семиноженко Ігор Володимирович",
    legalName: "Фізична особа-підприємець Семиноженко Ігор Володимирович",
    nameEn: "Sole Proprietor Ihor Volodymyrovych Semynozhenko",
    bankEn: "UNIVERSAL BANK JSC, bank code 322001",
    available: true,
    iban: "UA883220010000026008310026920",
    code: "3257316796",
    purpose: "",
    bank: 'АТ "УНІВЕРСАЛ БАНК", МФО 322001',
  },
  {
    id: "poberezhets",
    name: "ФОП Побережець Іван Юрійович",
    legalName: "ФОП Побережець Іван Юрійович",
    nameEn: "Sole Proprietor Ivan Yuriiovych Poberezhets",
    bankEn: null,
    available: true,
    iban: "UA453363100000026007011329540",
    code: "3803206192",
    purpose: "оплата за запчастини",
    bank: null,
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
    legalName: locale === "en" ? recipient.nameEn : recipient.legalName,
    bank: locale === "en" ? recipient.bankEn : recipient.bank,
  };
}
export function localizeProformaCountry(value: string | null | undefined, locale: "ua" | "en") {
  if (locale === "en" && value && /^(україна|украина|ukraine|ua)$/i.test(value.trim()))
    return "Ukraine";
  return value;
}
