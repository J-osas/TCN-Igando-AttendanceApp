
import { GoogleGenAI } from "@google/genai";

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { name } = await req.json();
    
    if (!name) {
      return new Response(JSON.stringify({ error: 'Name is required' }), { status: 400 });
    }

    // The API_KEY is accessed from Vercel's environment variables
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are a prophetic voice for a Christian crossover service. Generate a short, warm, and powerful word of encouragement for 2026 for ${name}. Theme: "Crossover to Abundance". Max 30 words.`,
    });

    const text = response.text || "Welcome to 2026, your year of abundance!";

    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ error: 'Failed to generate word' }), { status: 500 });
  }
}
