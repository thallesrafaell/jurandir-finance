import { GoogleGenAI } from "@google/genai";
import { config } from "../config";

const ai = new GoogleGenAI({});

export async function callGemini(message: string) {
  const response = await ai.models.generateContent({
    model: config.gemini.model,
    contents: message,
  });
  return response.text;
}
