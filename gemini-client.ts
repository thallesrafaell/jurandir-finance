
import { GoogleGenAI } from "@google/genai";
import { config } from "./src/config";

// The client gets the API key from the environment variable `GEMINI_API_KEY`.
const ai = new GoogleGenAI({});

export async function callGemini(message: string) {
  const response = await ai.models.generateContent({
    model: config.gemini.model,
    contents: message,
  });
  return response.text
}
