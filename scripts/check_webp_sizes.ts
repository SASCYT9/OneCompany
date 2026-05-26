import fs from "fs";
import path from "path";

const dir = "d:\\One Company\\OneCompany\\public\\images\\shop\\akrapovic";
const files = [
  "ducati-panigale-v2.webp",
  "bmw-s1000rr.webp",
  "yamaha-r1.webp",
  "kawasaki-zx10r.webp",
  "bmw-r1300gs.webp",
  "bmw-m1000rr.webp",
];

for (const f of files) {
  const p = path.join(dir, f);
  if (fs.existsSync(p)) {
    const size = fs.statSync(p).size;
    console.log(`${f}: ${size} bytes`);
  } else {
    console.log(`${f}: NOT FOUND`);
  }
}
