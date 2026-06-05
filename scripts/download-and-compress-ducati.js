const fs = require("fs");
const path = require("path");
const axios = require("axios");
const sharp = require("sharp");

const IMAGES_TO_PROCESS = [
  {
    key: "ducati-diavel-v4-exhaust",
    url: "https://desmoheart.com/cdn/shop/files/akra_diavel_v4_1024x1024@2x.png",
  },
  {
    key: "ducati-diavel-v4",
    url: "https://desmoheart.com/cdn/shop/files/diavel_v4_exhaust_1_1024x1024@2x.png",
  },
  {
    key: "ducati-streetfighter-v4-exhaust",
    url: "https://ducatism.com/cdn/shop/files/96482551AA.webp",
  },
  {
    key: "ducati-streetfighter-v4",
    url: "https://ducatism.com/cdn/shop/files/96482551AA_10.png",
  },
  {
    key: "ducati-diavel-1260-exhaust",
    url: "https://desmoheart.com/cdn/shop/products/TERMIGNONI-DUCATI-DIAVEL-1260-9648158_1024x1024@2x.jpg",
  },
  {
    key: "ducati-diavel-1260",
    url: "https://desmoheart.com/cdn/shop/products/TERMIGNONI-DUCATI-DIAVEL-1260_1024x1024@2x.png",
  },
];

async function downloadFile(url, destPath) {
  const writer = fs.createWriteStream(destPath);
  const response = await axios({
    url,
    method: "GET",
    responseType: "stream",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    },
  });

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
}

async function main() {
  const dir = "d:\\One Company\\OneCompany\\public\\images\\shop\\akrapovic";
  const origDir = path.join(dir, "originals");

  if (!fs.existsSync(origDir)) {
    fs.mkdirSync(origDir, { recursive: true });
  }

  for (const item of IMAGES_TO_PROCESS) {
    const ext = path.extname(new URL(item.url).pathname) || ".png";
    const tempName = `${item.key}_temp${ext}`;
    const tempPath = path.join(dir, tempName);
    const destName = `${item.key}.webp`;
    const destPath = path.join(dir, destName);

    console.log(`Downloading ${item.key} from ${item.url}...`);
    try {
      await downloadFile(item.url, tempPath);
      console.log(`  Downloaded temp file: ${tempName}`);

      console.log(`  Compressing and converting to WebP...`);
      await sharp(tempPath)
        .resize({ width: 1200, withoutEnlargement: true })
        .webp({ quality: 75 })
        .toFile(destPath);

      const origSize = fs.statSync(tempPath).size;
      const compSize = fs.statSync(destPath).size;

      console.log(`  Successfully compressed to ${destName}!`);
      console.log(
        `  Size: ${(origSize / 1024).toFixed(1)} KB -> ${(compSize / 1024).toFixed(1)} KB`
      );

      // Move temp original to originals folder
      const origDestPath = path.join(origDir, `${item.key}${ext}`);
      if (fs.existsSync(origDestPath)) {
        fs.unlinkSync(origDestPath);
      }
      fs.renameSync(tempPath, origDestPath);
      console.log(`  Moved original file to originals/${item.key}${ext}`);
    } catch (err) {
      console.error(`  Error processing ${item.key}:`, err.message);
      if (fs.existsSync(tempPath)) {
        try {
          fs.unlinkSync(tempPath);
        } catch (e) {}
      }
    }
  }

  console.log("=== Image Download & Compression Complete ===");
}

main();
