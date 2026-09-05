/** Reviewed supplier aliases from the public auto and moto fitment selectors.
 * Keep body styles and performance models separate. An empty result quarantines
 * an ambiguous fragment or a model assigned to the wrong make; it never invents fitment.
 */
export const SHOP_VEHICLE_MODEL_CORRECTIONS: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = {
  "aston martin": { "VANTAGE Vantage": ["Vantage"] },
  audi: { ATECA: [], "ENYAQ iV Coupe": [], "Q4 E-TRON Sportback": ["Q4 Sportback e-tron"] },
  bmw: {
    "M S 1000 Rr": ["M 1000 RR", "S 1000 RR"], M1000R: ["M 1000 R"], M1000RR: ["M 1000 RR"],
    "M1000rr Bmw": ["M 1000 RR"], "M1000rr Bmw M": ["M 1000 RR"], M1000XR: ["M 1000 XR"],
    R1300gs: ["R 1300 GS"], R1300r: ["R 1300 R"], "S 1000 Rr Street": ["S 1000 RR"],
    S1000R: ["S 1000 R"], S1000RR: ["S 1000 RR"], S1000XR: ["S 1000 XR"],
  },
  citroen: { "c-elysee": ["C-Elysee"] },
  ds: { ds3: ["DS 3"], ds5: ["DS 5"], "ds-3-crossback": ["DS 3 Crossback"], "ds7-crossback": ["DS 7 Crossback"], "DS 4 / DS 4 CROSSBACK": ["DS 4", "DS 4 Crossback"] },
  ducati: {
    "Diavel 1260 Ducati Diavel": ["Diavel 1260"], "Panigale V4 Carbon": ["Panigale V4"],
    "Panigale V4 V4": ["Panigale V4"], "Panigale V4 V4s": ["Panigale V4", "Panigale V4 S"],
    "Streetfighter V4 Ducati": ["Streetfighter V4"],
    "V4 Panigale Streetfighter Ducati Ducati": ["Panigale V4", "Streetfighter V4"],
    "Xdiavel 16 Diavel 1260": ["XDiavel", "Diavel 1260"],
  },
  ferrari: { "488 GTB / Spider": ["488 GTB", "488 Spider"], "599 GTB/GTO": ["599 GTB", "599 GTO"], Stradale: ["SF90 Stradale"], Tributo: ["F8 Tributo"], "F8 Tributo Coupe": ["F8 Tributo"] },
  ford: { "edge-2nd-gen": ["Edge"], "escape-3rd-gen": ["Escape"], "kuga-i": ["Kuga"], "tourneo-connect-grand-tourneo": ["Tourneo Connect", "Grand Tourneo Connect"] },
  honda: { fr: [], hr: [] },
  hyundai: { h: [], "i20-pb-pbt": ["i20"], "h-1-starex": ["H-1 Starex"] },
  infiniti: { "ex-qx50": ["EX", "QX50"], "fx-qx70": ["FX", "QX70"] },
  maserati: { "GRAN TURISMO": ["GranTurismo"], GRANCABRIO: ["GranCabrio"] },
  mazda: { bt: [], cx: [] },
  "mercedes benz": {
    A35: ["AMG A 35"], A45S: ["AMG A 45 S"], A250: ["A 250"], "C63 AMG": ["AMG C 63"], C63S: ["AMG C 63 S"],
    C200: ["C 200"], C250: ["C 250"], C300: ["C 300"], C400: ["C 400"], CLA35: ["AMG CLA 35"], CLA250: ["CLA 250"],
    E43: ["AMG E 43"], "E43 Coupe": ["AMG E 43 Coupe"], "E53 Coupe": ["AMG E 53 Coupe"], E200: ["E 200"], E400: ["E 400"],
    "G63 AMG": ["AMG G 63"], GLB35: ["AMG GLB 35"], GLC43: ["AMG GLC 43"], GLC63: ["AMG GLC 63"], "GLC63 AMG": ["AMG GLC 63"],
    GLE53: ["AMG GLE 53"], GLE63: ["AMG GLE 63"], GLE63S: ["AMG GLE 63 S"], GLE450: ["GLE 450"],
    GT: ["AMG GT"], GT43: ["AMG GT 43"], "AMG GT43": ["AMG GT 43"], GT53: ["AMG GT 53"], GT63: ["AMG GT 63"], GTR: ["AMG GT R"], GTS: ["AMG GT S"], SL43: ["AMG SL 43"],
  },
  mini: { "MINI CLUBMAN": ["Clubman"], "MINI COUNTRYMAN": ["Countryman"], "MINI COOPER": ["Cooper"], "MINI Convertible": ["Cabrio"], "Cooper S LCI": ["Cooper S"] },
  mitsubishi: { "l-200-kaot-kbot": ["L200"] },
  nissan: { R35: ["GT-R"], "nv250-kasten": ["NV250 Van"] },
  opel: { "antara-l": ["Antara"] },
  peugeot: { "partner-kasten-tepee": ["Partner Van", "Partner Tepee"] },
  polestar: { "POLESTAR 2": ["2"] },
  porsche: {
    Carrera: ["911 Carrera"], "Carrera S": ["911 Carrera S"], "Carrera GTS": ["911 Carrera GTS"], "Carrera Turbo": ["911 Turbo"],
    "911 Turbo / Turbo S": ["911 Turbo", "911 Turbo S"], "Cayenne 9Y0": ["Cayenne"], "Cayenne 9Y0 (Titanium)": ["Cayenne"],
    "Macan 2.0T / S / GTS / Turbo": ["Macan", "Macan S", "Macan GTS", "Macan Turbo"], "Macan S 2.9T": ["Macan S"],
  },
  saab: { "9": [] },
  scion: { BRZ: [] },
  seat: { "GOLF VII Estate": [] },
  subaru: { GR86: [] },
  toyota: { BRZ: [], rav: [], "ALPHARD / VELLFIRE": ["Alphard", "Vellfire"], "YARIS/VITZ": ["Yaris", "Vitz"], "GR 86 Coupe": ["GR86"], "Supra 2.0T": ["Supra"] },
  vauxhall: { "antara-l": ["Antara"], "zafira-mk": ["Zafira"] },
  volkswagen: { Born: [], "t7-stm-stn": ["Multivan T7"] },
};

const UPPER_TOKENS = new Set("amg asx ats bls brz cc cla cls cr crv cts cx dbs dbx ds ex ev ev6 fr fx gl glc gle gls gp gr gs gt gtb gtc gti gto gtr gts hr ii iii is iv jcw ka lc lci lp lx m mf mini mpv mu mx n nsx nx nv oem pb pbt qx rc rcz rf rr rs rsx s sc sl sls st sti suv svj sw sx t tdi tsi tt v v8 vi vii viii vr wrx x xc xe xf xj xkr xi xii xl xr".split(" "));
const WORD_CASE: Readonly<Record<string, string>> = { mito: "MiTo", ecosport: "EcoSport", spacetourer: "SpaceTourer", xceed: "XCeed", iq: "iQ", xd: "xD", "500e": "500e", stepwgn: "STEPWGN", xdiavel: "XDiavel" };
const SPACED_SLUG = /^(?:grand-|range-rover|discovery-sport|santa-fe|grande-punto|124-spider|c[345]-(?:aircross|picasso|spacetourer)|xsara-picasso|pajero-sport|space-star|almera-tino|tigra-twintop|zafira-life|panamera-sport-turismo|vel-satis|corolla-verso|land-cruiser|urban-cruiser|yaris-verso|golf-(?:plus|sportsvan)|gl[ce]-coupe)/i;

/** Cosmetic formatting only: punctuation and case never broaden model identity. */
export function formatVehicleModelLabel(value: string) {
  const cleaned = SPACED_SLUG.test(value) ? value.replace(/-/g, " ") : value;
  return cleaned.trim().replace(/\s+/g, " ").split(/([\s/-]+)/).map(token => {
    if (!/[a-z]/i.test(token)) return token;
    const lower = token.toLowerCase();
    if (WORD_CASE[lower]) return WORD_CASE[lower];
    if (/^id\./.test(lower)) return token.toUpperCase();
    if (/^(?:i\d+|ix\d+)$/.test(lower)) return lower;
    if (lower === "iv" && value.toLowerCase().includes("enyaq")) return "iV";
    if (UPPER_TOKENS.has(lower) || /^(?:[a-z]{1,3}\d+[a-z]*|\d+[a-z]{1,3}\d*)$/i.test(token)) return token.toUpperCase();
    return lower[0]!.toUpperCase() + lower.slice(1);
  }).join("");
}
