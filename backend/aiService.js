import { GoogleGenAI } from '@google/genai';
import { Setting } from './database.js';

// Retrieve the Gemini API key from database settings
async function getApiKey() {
  const row = await Setting.findOne({ key: 'gemini_api_key' });
  return row ? row.value : '';
}

// 1. Improve/Rephrase Email Template
export async function improveEmail(content, instruction) {
  const apiKey = await getApiKey();
  if (!apiKey) {
    // Graceful fallback mock
    return `[AI Mock Enhancement - Add Gemini API Key in Settings to enable actual AI rephrasing]\n\n${content}\n\n*(Refined with focus: ${instruction})*`;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `You are a professional B2B copywriter representing "Ve Veyron Exports", a high-quality Indian spice exporter.
Refine the B2B outreach email template provided below.
Instruction for refinement: "${instruction}"
CRITICAL: Do not remove or change any placeholder tags like {{Company_Name}}. Keep them exactly as they are.
Maintain a professional, polite, and persuasive tone.

Here is the email to refine:
-------------------
${content}
-------------------

Return only the refined email subject and/or body. Do not add conversational intro/outro text.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text.trim();
  } catch (error) {
    console.error('Gemini API Error in improveEmail:', error);
    throw new Error('Gemini AI failed to process email improvement: ' + error.message);
  }
}

// 2. Research Company & Generate Icebreaker
export async function researchCompany(companyName) {
  const apiKey = await getApiKey();
  if (!apiKey) {
    return {
      overview: `A professional company named ${companyName} likely operating in food retail, distribution, or manufacturing.`,
      icebreaker: `We noticed ${companyName}'s prominence in the quality food sector and believe our spice catalog would perfectly match your standard of sourcing.`
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `You are a B2B sales researcher for "Ve Veyron Exports" (Indian spice exporter).
Research the company name: "${companyName}".
Based on this name, provide:
1. A brief 2-sentence professional overview of what this company likely does (foodservice, spice processing, wholesale, import, retail, etc.).
2. A warm, professional, and natural 1-sentence opening line/icebreaker that we can use to start a personalized pitch email to them. Do not sound generic; make it fit their profile.

Format the output strictly as a JSON object with exactly these two keys:
{
  "overview": "...",
  "icebreaker": "..."
}
Do not write markdown formatting wrappers like \`\`\`json. Return only the raw JSON.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const text = response.text.trim();
    // Safely parse JSON, removing markdown code blocks if the model ignored instructions
    const cleanJsonText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJsonText);
  } catch (error) {
    console.error('Gemini API Error in researchCompany:', error);
    // Fallback on error
    return {
      overview: `An importer/distributor in the agricultural food industry.`,
      icebreaker: `I hope this email finds the ${companyName} team well. We are reaching out to explore spice sourcing opportunities.`
    };
  }
}

// 3. Classify Buyer & Outline Needs
export async function classifyBuyer(companyName, productInterest) {
  const apiKey = await getApiKey();
  if (!apiKey) {
    // Quick heuristic-based mock classification
    const interest = (productInterest || '').toLowerCase();
    let category = 'Wholesaler';
    if (interest.includes('retail') || interest.includes('supermarket')) category = 'Retailer';
    else if (interest.includes('factory') || interest.includes('manufacturer') || interest.includes('blend')) category = 'Food Manufacturer';
    else if (interest.includes('pack')) category = 'Spice Packer';

    return {
      category,
      needsSummary: `Interested in sourcing ${productInterest || 'High-quality agricultural spices'} for bulk supply.`
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Classify this buyer for B2B lead scoring.
Company: "${companyName}"
Stated Interest: "${productInterest || 'Unspecified Spices'}"

Determine:
1. Category: Must be exactly one of: [Wholesaler, Distributor, Retailer, Food Manufacturer, Spice Packer, Food Service, Unknown]
2. Needs Summary: A 1-sentence summary of what spices/packaging they likely require.

Format output strictly as a JSON object:
{
  "category": "...",
  "needsSummary": "..."
}
Return only raw JSON.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const text = response.text.trim();
    const cleanJsonText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJsonText);
  } catch (error) {
    console.error('Gemini API Error in classifyBuyer:', error);
    return {
      category: 'Unknown',
      needsSummary: `Interested in: ${productInterest || 'Spices'}`
    };
  }
}
