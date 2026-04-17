import fs from "fs";
import path from "path";

function walk(dir, callback) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const p = path.join(dir, file);
    if (fs.statSync(p).isDirectory()) {
      walk(p, callback);
    } else if (p.endsWith(".tsx") || p.endsWith(".ts")) {
      callback(p);
    }
  }
}

let count = 0;

walk("src/app/admin", (file) => {
  let content = fs.readFileSync(file, "utf8");
  let original = content;

  // 1. Shadows
  content = content.replace(/\bshadow-(sm|md|lg|xl)\b/g, "border border-white/5");
  content = content.replace(/\bshadow\b(?!\-)/g, "border border-white/5");

  // 2. Primary CTAs (Blue/Indigo/Purple/Pink to Zinc High-End High-Contrast)
  content = content.replace(/\bbg-(blue|indigo|purple|pink)-(500|600)\b/g, "bg-zinc-100 text-black");
  content = content.replace(/\bhover:bg-(blue|indigo|purple|pink)-(600|700)\b/g, "hover:bg-white");
  
  // 3. Text Colors (Primary)
  content = content.replace(/\btext-(blue|indigo|purple|pink)-(500|600)\b/g, "text-zinc-200");
  content = content.replace(/\btext-(blue|indigo|purple|pink)-(400)\b/g, "text-zinc-400");
  content = content.replace(/\btext-(blue|indigo|purple|pink)-(300)\b/g, "text-zinc-500");

  // 4. Status Colors (Red, Green, Yellow to Dark Mode Borders)
  content = content.replace(/\bbg-red-(500|600)\b/g, "bg-red-950/30 border border-red-900/50 text-red-500");
  content = content.replace(/\bbg-green-(500|600)\b/g, "bg-emerald-950/30 border border-emerald-900/50 text-emerald-500");
  content = content.replace(/\bbg-yellow-(500|600)\b/g, "bg-amber-950/30 border border-amber-900/50 text-amber-500");
  
  content = content.replace(/\bhover:bg-red-600\b/g, "hover:bg-red-900/50");
  content = content.replace(/\bhover:bg-green-600\b/g, "hover:bg-emerald-900/50");
  content = content.replace(/\bhover:bg-yellow-600\b/g, "hover:bg-amber-900/50");

  // 5. Cleanup conflicting classes inside quotes
  // Find everything between className="..." or className={`...`}
  // Use a string replace that works on substrings
  // Replace text-white when text-black also exists in the same block.
  content = content.replace(/className=(["`])(.*?)\1/gs, (match, quote, inner) => {
    if (inner.includes('text-black') && inner.includes('text-white')) {
      // Remove text-white if we just injected text-black
      let newInner = inner.replace(/\btext-white\b/g, '').replace(/\s+/g, ' ').trim();
      return `className=${quote}${newInner}${quote}`;
    }
    return match;
  });

  if (content !== original) {
    fs.writeFileSync(file, content);
    count++;
  }
});

console.log("Premiumized files: " + count);
