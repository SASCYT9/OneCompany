/**
 * Repeating tasks are ordinary tasks with a `repeat:<rule>` tag. These helpers
 * have no server dependencies, so the admin UI can use them too.
 */
export const OPS_REPEAT_RULES = ["daily", "weekdays", "weekly", "monthly"] as const;
export type OpsRepeatRule = (typeof OPS_REPEAT_RULES)[number];
export const OPS_REPEAT_TAG_PREFIX = "repeat:";
export const OPS_REPEAT_TAGS = OPS_REPEAT_RULES.map((rule) => `${OPS_REPEAT_TAG_PREFIX}${rule}`);

const REPEAT_LABELS: Record<OpsRepeatRule, string> = {
  daily: "Каждый день",
  weekdays: "По будням",
  weekly: "Каждую неделю",
  monthly: "Каждый месяц",
};

export function opsRepeatLabel(rule: OpsRepeatRule) {
  return REPEAT_LABELS[rule];
}

export function isOpsRepeatTag(tag: string) {
  return tag.toLocaleLowerCase("en-US").startsWith(OPS_REPEAT_TAG_PREFIX);
}

export function opsRepeatRuleFromTags(tags: readonly string[]): OpsRepeatRule | null {
  for (const tag of tags) {
    const rule = tag.toLocaleLowerCase("en-US").slice(OPS_REPEAT_TAG_PREFIX.length);
    if (isOpsRepeatTag(tag) && (OPS_REPEAT_RULES as readonly string[]).includes(rule)) {
      return rule as OpsRepeatRule;
    }
  }
  return null;
}

export function withOpsRepeatRule(tags: readonly string[], rule: OpsRepeatRule | null) {
  const rest = tags.filter((tag) => !isOpsRepeatTag(tag));
  return rule ? [...rest, `${OPS_REPEAT_TAG_PREFIX}${rule}`] : rest;
}

/** Recognises «каждую неделю», «щодня», «по будням», «щомісяця», «не повторять». */
export function parseOpsRepeatRule(text: string): OpsRepeatRule | "off" | null {
  const value = text.toLocaleLowerCase("ru-RU").replace(/\s+/g, " ").trim();
  if (/(?:не повтор|без повтор|больше не повтор|не повторюв|перестань повтор)/u.test(value)) {
    return "off";
  }
  if (/(?:по будн|по робоч|в будни|у будні|кажд\p{L}* будн)/u.test(value)) return "weekdays";
  if (/(?:кажд\p{L}* (?:день|утро|вечер)|ежедневно|щодня|щоденно|кожн\p{L}* день)/u.test(value)) {
    return "daily";
  }
  if (
    /(?:кажд\p{L}* (?:недел|понедельник|вторник|сред|четверг|пятниц|суббот|воскресень)|еженедельно|щотижня|кожн\p{L}* (?:тиж|понед|вівтор|серед|четвер|п.ятниц|субот|неділ))/u.test(
      value
    )
  ) {
    return "weekly";
  }
  if (/(?:кажд\p{L}* месяц|ежемесячно|щомісяця|кожн\p{L}* місяц)/u.test(value)) return "monthly";
  return null;
}
