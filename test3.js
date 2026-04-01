require('dotenv').config({path:'d:/OneCompany/.env'});
const fetch = require('node-fetch') || globalThis.fetch;
async function run() {
  const aiParams = {
    model: '@cf/meta/llama-3.1-8b-instruct',
    messages: [
      { role: 'system', content: `You are an auto-parts logistics AI expert. 
Your goal is to accurately estimate the boxed shipping dimensions (in cm) and weight (in kg) of automotive car parts based on their title, brand, and category.
Provide ONLY a valid JSON object without any extra text, wrapper, or markdown formatting.
Required JSON format:
{
  "weight": number,
  "length": number,
  "width": number,
  "height": number
}` },
      { role: 'user', content: `Estimate shipping dimensions for: \nBrand: Brabus\nTitle: Certified vehicle armouring INVICTO for Mercedes - W463A - G 350 - G 500\nSKU: 464-INVICTO\nCategory: Auto Item\nReturn only valid JSON.` }
    ]
  };
  const res = await fetch('https://api.cloudflare.com/client/v4/accounts/' + process.env.CLOUDFLARE_ACCOUNT_ID + '/ai/run/' + aiParams.model, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.CLOUDFLARE_API_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(aiParams)
  });
  const data = await res.json();
  console.log("Raw LLama Output:");
  console.log(data.result?.response);
}
run();
