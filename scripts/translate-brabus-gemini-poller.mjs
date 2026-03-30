import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { execSync } from 'child_process';

dotenv.config({ override: true });

async function poll() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Missing GEMINI_API_KEY. Exiting.");
    process.exit(1);
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  let attempts = 0;
  while (attempts < 20) {
    try {
      console.log(`[Attempt ${attempts+1}/20] Checking if Google Cloud has enabled the API...`);
      await model.generateContent("test");
      console.log("✅ Google Cloud API is NOW ACTIVE!");
      console.log("🚀 Starting the main translation pipeline...");
      execSync('node scripts/translate-brabus-gemini.mjs', { stdio: 'inherit' });
      return;
    } catch (e) {
      if (e.message.includes("403 Forbidden") && e.message.includes("disabled")) {
        console.log("⏳ Google Cloud is still processing your new API Key. Waiting 15 seconds...");
        await new Promise(r => setTimeout(r, 15000));
        attempts++;
      } else {
        console.error("❌ Unexpected error:", e.message);
        break;
      }
    }
  }
}

poll();
