export class AILogisticsService {
  /**
   * Estimates dimensions for a product using Cloudflare's Llama 3 model
   */
  static async estimateDimensions(
    title: string,
    brand: string,
    sku?: string,
    categoryName?: string
  ) {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiKey = process.env.CLOUDFLARE_API_TOKEN;

    if (!accountId || !apiKey) {
      throw new Error('CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN is not configured.');
    }

    const aiParams = {
      model: '@cf/meta/llama-3.1-8b-instruct',
      messages: [
        {
          role: 'system',
          content: `You are an auto-parts logistics AI expert. 
Your goal is to accurately estimate the boxed shipping dimensions (in cm) and weight (in kg) of automotive car parts based on their title, brand, and category.
Provide ONLY a valid JSON object without any extra text, wrapper, or markdown formatting.
Required JSON format:
{
  "weight": number,
  "length": number,
  "width": number,
  "height": number,
  "reasoning": string // Briefly explain in Ukrainian why these dimensions were chosen (e.g., "Стандартні габарити для інтеркулера BMW" or "Це дрібна деталь, тому вага до 1 кг")
}
For example, for a "do88 Intercooler BMW F80", return {"weight": 14, "length": 80, "width": 40, "height": 30, "reasoning": "Інтеркулер зазвичай поставляється у великій коробці 80х40х30 та важить близько 14 кг"}`
        },
        {
          role: 'user',
          content: `Estimate shipping dimensions for: \nBrand: ${brand}\nTitle: ${title}\nSKU: ${sku || 'Unknown'}\nCategory: ${categoryName || 'Auto Item'}\nReturn only valid JSON.`
        }
      ]
    };

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${aiParams.model}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(aiParams) // passing messages inside aiParams
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error('Cloudflare AI API Error:', text);
      throw new Error(`Cloudflare AI API request failed with status ${response.status}`);
    }

    const data = await response.json();
    let rawText = data.result?.response || '';

    // sanitize output to ensure pure JSON
    rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
      const parsed = JSON.parse(rawText);
      return {
        weight: typeof parsed.weight === 'number' ? parsed.weight : null,
        length: typeof parsed.length === 'number' ? parsed.length : null,
        width: typeof parsed.width === 'number' ? parsed.width : null,
        height: typeof parsed.height === 'number' ? parsed.height : null,
        raw_output: rawText,
        model: aiParams.model
      };
    } catch (e: any) {
      throw new Error('Failed to parse Cloudflare AI JSON response: ' + rawText);
    }
  }
}
