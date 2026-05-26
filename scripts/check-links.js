async function run() {
  const res = await fetch("https://onecompany.global/en/shop/akrapovic");
  const html = await res.text();
  const regex = /\/shop\/[a-zA-Z0-9_-]+/g;
  const matches = html.match(regex);
  if (!matches) {
    console.log("No matches");
  } else {
    console.log("Matches length:", matches.length);
    console.log("Unique matches:", [...new Set(matches)].slice(0, 20));
  }
}
run();
