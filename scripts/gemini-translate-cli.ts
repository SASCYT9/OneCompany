import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("Error: GEMINI_API_KEY is not set in .env.local");
  console.log("Please add GEMINI_API_KEY=your_api_key to your .env.local file.");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
// Using the advanced 3.1 Pro model for maximum translation quality and context
const model = genAI.getGenerativeModel({ model: "gemini-3.1-pro" });

async function translate() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Gemini Translation CLI
----------------------
Usage: 
  npm run translate:gemini -- "text to translate" [target_language]
  npm run translate:gemini -- path/to/file.txt [target_language]

Examples:
  npm run translate:gemini -- "Привіт, як справи?" English
  npm run translate:gemini -- ./data/product.md "German"
`);
    return;
  }

  const input = args[0];
  const targetLang = args[1] || 'English';

  let textToTranslate = input;
  let isFile = false;

  // Check if input is a file path
  try {
    if (fs.existsSync(input) && fs.statSync(input).isFile()) {
      textToTranslate = fs.readFileSync(input, 'utf-8');
      isFile = true;
      console.log(`Reading from file: ${input}`);
    }
  } catch (e) {
    // Treat as raw text if error occurs checking file
  }

  console.log(`Translating to ${targetLang}...`);

  const prompt = `You are a professional translator. Translate the following text to ${targetLang}.
CRITICAL INSTRUCTIONS:
- Preserve all formatting exactly as is (newlines, markdown, HTML tags).
- Do not add any conversational text or formatting outside the translation.
- Only output the translated text.

TEXT TO TRANSLATE:
${textToTranslate}`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    console.log("\n=== TRANSLATION ===");
    console.log(responseText);
    console.log("===================\n");
    
    if (isFile) {
      const ext = path.extname(input);
      const base = path.basename(input, ext);
      const dir = path.dirname(input);
      // Create a suffixed file for convenience, e.g. product.en.md
      const langSuffix = targetLang.substring(0, 2).toLowerCase();
      const outPath = path.join(dir, `${base}.${langSuffix}${ext}`);
      
      fs.writeFileSync(outPath, responseText, 'utf-8');
      console.log(`Saved translation to: ${outPath}`);
    }

  } catch (error) {
    console.error("Translation failed:", error);
  }
}

translate();
