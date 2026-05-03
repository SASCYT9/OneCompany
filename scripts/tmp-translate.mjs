import fs from 'fs';

const SITE_CONTENT_FILE = 'public/config/site-content.json';
const siteContent = JSON.parse(fs.readFileSync(SITE_CONTENT_FILE, 'utf8'));

const translations = {
  "ig-dweba1mjnjq": {
    title: "Urban Automotive opens a new chapter for Lamborghini Urus SE",
    caption: "Urban Automotive opens a new chapter for Lamborghini Urus SE.\n\nThe Widetrack programme is a complete reimagining of the silhouette: carbon widebody, aggressive geometry, and a recognizable design created after thousands of hours of engineering work.\n\n800+ hp of hybrid power gets a look that matches the character of this Super SUV.\n\nAvailable at One Company\n\n#urbanautomotive #urusSE #cartuning #onecompany"
  },
  "ig-dwbybfkjhxp": {
    title: "Carbon-ceramic brake discs by Stopflex - stability and control",
    caption: "Carbon-ceramic brake discs by @stopflexcarbonceramicdiscs - stability and control under any conditions.\n\nLonger lifespan, stable performance even at high temperatures, and significantly less weight compared to standard cast-iron discs. Motorsport technologies adapted for everyday road use.\n\nOrdering, selection, and consultation - at One Company.\n\n#stopflex #carbrakes #cartuning #onecompany"
  },
  "ig-dwwgptejkmd": {
    title: "The unique sound of Novitec exhaust system 🔥",
    caption: "The unique sound of @novitecgroup exhaust system 🔥\n\nEngineering that reveals the true voice of the car and makes it truly recognizable.\n\nAvailable at One Company.\n\n#novitec #novitecexhaust #cartuning #onecompany"
  },
  "ig-dwplj-pjawz": {
    title: "Vörsteiner wheels - the perfect balance of form, style and character",
    caption: "Vörsteiner wheels - the perfect balance of form, style and character.\n\nExpressive geometry, premium design, and details that create a strong visual accent without any compromise.\n\nThe finishing touch for your look. Ordering, selection, and consultation - at One Company.\n\n#vörsteiner #vorsteiner #onecompany #cartuning"
  },
  "ig-dvbossajmkr": {
    title: "Meet the exclusive BRABUS upgrade programme for the most powerful Urus ever",
    caption: "Meet the exclusive upgrade programme for the most powerful Urus in history. BRABUS raises the bar once again, offering an exclusive aerodynamic package made from high-tech carbon fiber.\n\nWhat's included in the new package:\n— Carbon Front Fascia: a massive front section that gives the Urus an even more predatory look.\n— Carbon Wheel Arch Extensions: wheel arch flares that add muscularity and road presence.\n— Carbon Rear Diffuser & Spoiler: the perfect finishing touch for the rear."
  },
  "ig-du8slwwdp1c": {
    title: "IPE exhaust system - the voice of your car",
    caption: "The exhaust system is the voice of your car. And when we talk about IPE, that voice becomes flawless. A premium system, built for those who refuse to compromise between comfort and sporty character.\n\nWhy IPE is the number one choice for the G90?\n— Valvetronic System: Control your emotions. One press - and you switch between quiet city mode and aggressive track sound.\n— Sound Purity: A deep, rich tone without excess resonance or cabin drone.\n— Performance: Optimized exhaust gas flow."
  },
  "ig-du56j1ejlfg": {
    title: "RaceChip - unlock the full potential of your engine",
    caption: "Want to unlock the full potential of your engine without interfering with factory settings and software? RaceChip is a world leader in chip tuning, offering a safe and effective plug & play solution.\nIt's the perfect option for those who want more dynamics while maintaining their car's warranty and reliability.\n\nWhy choose RaceChip?\n— Real gains: Up to +30% power increase and up to +30% torque increase (depending on model and engine).\n— Engine safety: All factory protection systems remain active."
  },
  "ig-du3a9ygdgjr": {
    title: "VPX TrackWheels - minimum weight, maximum rigidity",
    caption: "If your goal is minimal unsprung mass and maximum rigidity in corners, VPX TrackWheels are made for you. This is a brand focused on engineering, where every gram of weight matters for the stopwatch.\nWhy VPX is the choice for serious projects?\n\n— Aviation-grade 6061-T6 aluminium: Wheels are manufactured using hot forging under 10,000 tons of pressure, providing incredible strength at low weight.\n— Track-Ready design: Every model is engineered to ensure maximum cooling."
  }
};

let updated = 0;

for (const [postId, trans] of Object.entries(translations)) {
  const post = siteContent.blog.posts.find(p => p.id === postId);
  if (post) {
    post.title.en = trans.title;
    post.caption.en = trans.caption;
    updated++;
    console.log(`✅ ${postId}: "${trans.title}"`);
  } else {
    console.log(`❌ ${postId}: NOT FOUND`);
  }
}

fs.writeFileSync(SITE_CONTENT_FILE, JSON.stringify(siteContent, null, 2));
console.log(`\nTranslated ${updated} posts to English.`);
