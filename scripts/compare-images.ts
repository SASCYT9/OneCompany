import axios from "axios";
import fs from "fs";
import path from "path";

const url1 =
  "https://d1sfhav1wboke3.azureedge.net/ImageServer/Apim2Media/Images/22677/cb4470e0-4342-4044-8590-49037d6ea8fb.png";
const url2 =
  "https://d1sfhav1wboke3.azureedge.net/ImageServer/Apim2Media/Images/22677/1e8fdb5a-b047-4324-acbb-2937e62c6ac9.png";

const artifactDir =
  "C:\\Users\\sascy\\.gemini\\antigravity\\brain\\24b7c8d2-556a-4e42-8d8d-852724ffa9da";

async function downloadImage(url: string, filename: string) {
  try {
    const dest = path.join(artifactDir, filename);
    const response = await axios.get(url, { responseType: "stream" });
    const writer = fs.createWriteStream(dest);
    response.data.pipe(writer);
    return new Promise<void>((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });
  } catch (error: any) {
    console.error(`Error downloading ${filename}:`, error.message);
  }
}

async function main() {
  console.log("Downloading images...");
  await downloadImage(url1, "akra_img1.png");
  await downloadImage(url2, "akra_img2.png");
  console.log("Done!");
}

main();
