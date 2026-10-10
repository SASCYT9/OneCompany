/**
 * One hierarchy for the vehicle picker and for the listing it opens:
 * make -> model family -> trim -> generation -> facelift.
 *
 * Selecting a node includes everything below it (`911` -> every 911 trim,
 * `992` -> `992.1` and `992.2`). Products filed on an ancestor only (`992` for
 * a `992.1` request, `911` for `911 Carrera`) are a second, lower tier.
 * Siblings are never mixed (992.2 for 992.1, GT3 for Carrera).
 */
import { normalizeShopSearchText } from "./shopSearch";
import { SHOP_VEHICLE_MODEL_FAMILIES } from "./shopVehicleModelFamilies";
import {
  canonicalVehicleMakeLabel,
  canonicalVehicleModelLabel,
  vehicleModelKey,
} from "./shopVehicleTaxonomy";

/** Established spellings of one chassis (BMW M2 `F87N` is shown as `F87`). */
const CHASSIS_KEY_ALIASES: Readonly<Record<string, string>> = { f87n: "f87" };

function rawChassisKey(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "")
    .replace(/^\.+|\.+$/g, "");
}

/** Case, spacing and dash insensitive identity: `W 463A` === `w-463a`. */
export function vehicleChassisKey(value: string | null | undefined) {
  const key = rawChassisKey(value);
  return CHASSIS_KEY_ALIASES[key] ?? key;
}

/** Every raw stored key that means this chassis (for SQL on raw values). */
export function vehicleChassisKeyVariants(value: string | null | undefined) {
  const key = vehicleChassisKey(value);
  if (!key) return [];
  return [
    key,
    ...Object.entries(CHASSIS_KEY_ALIASES)
      .filter(([, canonical]) => canonical === key)
      .map(([alias]) => alias),
  ];
}

/** `992.1` -> `992`, `mk7.5` -> `mk7`, `g20lci` -> `g20`; null for a root code. */
function chassisParentKey(key: string): string | null {
  const facelift = /^(.+?)(?:pre)?lci$/.exec(key);
  if (facelift?.[1]) return facelift[1];
  const dotted = /^(.+)\.\d+$/.exec(key);
  if (dotted?.[1]) return dotted[1];
  return null;
}

function chassisAncestorKeys(key: string) {
  const ancestors: string[] = [];
  for (let parent = chassisParentKey(key); parent; parent = chassisParentKey(parent)) {
    ancestors.push(parent);
  }
  return ancestors;
}

export type VehicleChassisMatch = "exact" | "descendant" | "ancestor" | null;

/**
 * How a stored chassis/generation code relates to the requested one.
 * `descendant`: the product is filed on a more specific code (request `992`,
 * product `992.1`). `ancestor`: filed on a broader one (request `992.1`,
 * product `992`).
 */
export function vehicleChassisMatchLevel(
  candidate: string | null | undefined,
  requested: string | null | undefined
): VehicleChassisMatch {
  const candidateKey = vehicleChassisKey(candidate);
  const requestedKey = vehicleChassisKey(requested);
  if (!candidateKey || !requestedKey) return null;
  if (candidateKey === requestedKey) return "exact";
  if (chassisAncestorKeys(candidateKey).includes(requestedKey)) return "descendant";
  if (chassisAncestorKeys(requestedKey).includes(candidateKey)) return "ancestor";
  return null;
}

/**
 * Every code a stored chassis can satisfy: itself and its ancestors. Used to
 * list picker options (`992.1` and `992.2` products make `992` selectable).
 */
export function vehicleChassisSelfAndAncestors(value: string) {
  const key = vehicleChassisKey(value);
  if (!key) return [];
  return [value.trim(), ...chassisAncestorKeys(key).map((ancestor) => ancestor.toUpperCase())];
}

type FamilyIndex = {
  /** normalized base label -> members (labels) */
  membersByBase: Map<string, { label: string; members: string[] }>;
  /** normalized member label -> bases (labels) */
  basesByMember: Map<string, string[]>;
  /** normalized member label -> label */
  memberLabels: Map<string, string>;
};

const familyIndexes = new Map<string, FamilyIndex | null>();

function makeLookupKey(make: string) {
  return normalizeShopSearchText(canonicalVehicleMakeLabel(make));
}

function familyIndexFor(make: string): FamilyIndex | null {
  const makeKey = makeLookupKey(make);
  if (familyIndexes.has(makeKey)) return familyIndexes.get(makeKey) ?? null;
  const entry = Object.entries(SHOP_VEHICLE_MODEL_FAMILIES).find(
    ([name]) => makeLookupKey(name) === makeKey
  );
  let index: FamilyIndex | null = null;
  if (entry) {
    index = { membersByBase: new Map(), basesByMember: new Map(), memberLabels: new Map() };
    for (const [base, members] of Object.entries(entry[1])) {
      index.membersByBase.set(normalizeShopSearchText(base), {
        label: base,
        members: [...members],
      });
      for (const member of members) {
        const memberKey = normalizeShopSearchText(member);
        index.basesByMember.set(memberKey, [...(index.basesByMember.get(memberKey) ?? []), base]);
        index.memberLabels.set(memberKey, member);
      }
    }
  }
  familyIndexes.set(makeKey, index);
  return index;
}

function uniqueLabels(values: readonly string[]) {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const value of values) {
    const key = vehicleModelKey(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    labels.push(value);
  }
  return labels;
}

export type VehicleModelScope = {
  /** Selected model plus everything below it (a base includes its trims). */
  exact: string[];
  /** `exact` plus the families the selection belongs to (lower tier). */
  broad: string[];
};

export function vehicleModelScope(make: string, model: string): VehicleModelScope {
  const label = canonicalVehicleModelLabel(make, model);
  const requested = label || model.trim();
  const index = familyIndexFor(make);
  if (!index || !requested)
    return { exact: requested ? [requested] : [], broad: requested ? [requested] : [] };
  const requestedKey = normalizeShopSearchText(requested);
  const family = index.membersByBase.get(requestedKey);
  // A trim also owns the trims named after it (`911 Carrera` -> `911 Carrera S`).
  const prefix = `${requestedKey} `;
  // A member owned by a more specific family (`Range Rover Sport II` under
  // `Range Rover Sport`) is a distinct vehicle, not a descendant.
  const descendants = [...index.memberLabels.entries()]
    .filter(
      ([memberKey]) =>
        memberKey.startsWith(prefix) &&
        !(index.basesByMember.get(memberKey) ?? []).some((base) => {
          const baseKey = normalizeShopSearchText(base);
          return baseKey !== requestedKey && baseKey.startsWith(prefix);
        })
    )
    .map(([, memberLabel]) => memberLabel);
  const exact = uniqueLabels([requested, ...(family?.members ?? []), ...descendants]);
  const parents = index.basesByMember.get(requestedKey) ?? [];
  const broad = uniqueLabels([...exact, ...parents]);
  return { exact, broad };
}

/** Base model of a trim (`911 GT3 RS` -> `911`), or null when it has none. */
export function vehicleModelFamilyBase(make: string, model: string) {
  const index = familyIndexFor(make);
  if (!index) return null;
  const bases = index.basesByMember.get(
    normalizeShopSearchText(canonicalVehicleModelLabel(make, model))
  );
  return bases?.[0] ?? null;
}

/** Every enclosing base (`911 Carrera S` -> `911`, `911 Carrera`). */
export function vehicleModelFamilyBases(make: string, model: string): string[] {
  const index = familyIndexFor(make);
  if (!index) return [];
  return [
    ...(index.basesByMember.get(normalizeShopSearchText(canonicalVehicleModelLabel(make, model))) ??
      []),
  ];
}

/** Labels of one family, base first; the model itself when it has no family. */
export function vehicleModelFamilyLabels(make: string, model: string) {
  return vehicleModelScope(make, model).exact;
}
