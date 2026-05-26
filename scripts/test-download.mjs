import fetch from "node-fetch";

const candidates = [
  // Ducati
  "https://www.carpimoto.com/Images/Products/Zoom/S_D11E3_FJTD_1.jpg",
  "https://www.carpimoto.com/Images/Products/Zoom/S_D11E3_FJTD.jpg",
  "https://www.carpimoto.com/Images/Products/Zoom/S_D11E3_ACT.jpg",
  "https://www.carpimoto.com/Images/Products/Zoom/S_D11E3_FJTD_1_Z.jpg",
  "https://www.carpimoto.com/Images/Products/Zoom/S_D11E3_FJTD_Z.jpg",
  // Yamaha
  "https://www.carpimoto.com/Images/Products/Zoom/S_Y10E3_APT.jpg",
  "https://www.carpimoto.com/Images/Products/Zoom/S_Y10E3_APT_Z.jpg",
  // BMW R 1300 GS
  "https://www.carpimoto.com/Images/Products/Zoom/S_B13SO4_HLGT.jpg",
  "https://www.carpimoto.com/Images/Products/Zoom/S_B13SO4_HLGT_Z.jpg",
  "https://www.carpimoto.com/Images/Products/Zoom/S_B13SO4_HJGT.jpg", // let's check HJGT too
  "https://www.carpimoto.com/Images/Products/Zoom/S_B13SO4_HJGT_Z.jpg",
  // Kawasaki ZX-10R
  "https://www.carpimoto.com/Images/Products/Zoom/S_K10SO27_HRC.jpg",
  "https://www.carpimoto.com/Images/Products/Zoom/S_K10SO27_HRC_Z.jpg",
  "https://www.carpimoto.com/Images/Products/Zoom/S_K10SO27_HRT.jpg",
  "https://www.carpimoto.com/Images/Products/Zoom/S_K10SO27_HRT_Z.jpg",
];

async function test() {
  for (const url of candidates) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (res.status === 200) {
        console.log(`FOUND: ${url}`);
      }
    } catch (e) {
      console.log(`Error for ${url}: ${e.message}`);
    }
  }
}

test();
