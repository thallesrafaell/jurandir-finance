import { GoogleGenAI, Content } from "@google/genai";
import { config } from "../config";
import { SYSTEM_PROMPT, getGroupSystemPrompt } from "./prompts";
import { tools, groupTools } from "./tools";
import { executeTool } from "./handlers";
import { agentLogger, toolLogger } from "../utils/logger";
import type { MessageContext } from "../types";

const ai = new GoogleGenAI({});

const conversationHistory = new Map<string, Content[]>();
const MAX_HISTORY = 20;

function getHistoryKey(context: MessageContext): string {
  return context.isGroup && context.groupId ? context.groupId : context.userId;
}

function getHistory(context: MessageContext): Content[] {
  const key = getHistoryKey(context);
  if (!conversationHistory.has(key)) {
    conversationHistory.set(key, []);
  }
  return conversationHistory.get(key)!;
}

function addToHistory(context: MessageContext, role: "user" | "model", text: string) {
  const history = getHistory(context);
  history.push({ role, parts: [{ text }] });

  if (history.length > MAX_HISTORY) {
    history.splice(0, history.length - MAX_HISTORY);
  }
}

function aggregateToolResults(results: string[]): string {
  if (results.length === 1) return results[0];

  const registros = results.filter((r) => r.includes("registrad"));
  const exclusoes = results.filter((r) => r.includes("🗑️") || r.includes("removid"));
  const edicoes = results.filter((r) => r.includes("✏️") || r.includes("atualizad"));
  const marcacoes = results.filter((r) => r.includes("✅") || r.includes("⏳"));
  const erros = results.filter((r) => r.includes("não encontrad") || r.includes("Nenhum"));
  const outros = results.filter(
    (r) =>
      !r.includes("registrad") &&
      !r.includes("🗑️") &&
      !r.includes("removid") &&
      !r.includes("✏️") &&
      !r.includes("atualizad") &&
      !r.includes("✅") &&
      !r.includes("⏳") &&
      !r.includes("não encontrad") &&
      !r.includes("Nenhum")
  );

  const partes: string[] = [];

  if (registros.length > 0) {
    partes.push(registros.length <= 3 ? registros.join("\n") : `✅ ${registros.length} itens registrados com sucesso!`);
  }

  if (exclusoes.length > 0) {
    partes.push(exclusoes.length <= 3 ? exclusoes.join("\n") : `🗑️ ${exclusoes.length} itens removidos!`);
  }

  if (edicoes.length > 0) partes.push(edicoes.join("\n"));
  if (marcacoes.length > 0) partes.push(marcacoes.join("\n"));
  if (erros.length > 0 && erros.length <= 3) partes.push(erros.join("\n"));
  if (outros.length > 0) partes.push(outros.join("\n"));

  return partes.join("\n\n") || results.join("\n");
}

export async function processMessage(userMessage: string, context: MessageContext): Promise<string> {
  const { userId, groupId, isGroup } = context;
  agentLogger.info({ userId, groupId, isGroup, message: userMessage }, "Processing message");

  try {
    addToHistory(context, "user", userMessage);
    const history = getHistory(context);

    const activeTools = isGroup ? [...tools, ...groupTools] : tools;
    const systemPrompt = isGroup ? getGroupSystemPrompt() : SYSTEM_PROMPT;

    agentLogger.debug({ model: config.gemini.model, historyLength: history.length, isGroup }, "Calling Gemini");

    let currentContents = [...history];
    let response = await ai.models.generateContent({
      model: config.gemini.model,
      contents: currentContents,
      config: {
        systemInstruction: systemPrompt,
        tools: [{ functionDeclarations: activeTools }],
      },
    });

    const MAX_ITERATIONS = 30;
    let iterations = 0;
    let lastToolResults: string[] = [];

    while (iterations < MAX_ITERATIONS) {
      iterations++;

      const candidate = response.candidates?.[0];
      const parts = candidate?.content?.parts || [];
      const functionCalls = parts.filter((p) => p.functionCall);

      if (functionCalls.length === 0) break;

      agentLogger.info({ count: functionCalls.length, iteration: iterations }, "Processing function calls");

      const functionCallParts: Array<{ functionCall: { name: string; args: unknown } }> = [];
      const functionResponseParts: Array<{ functionResponse: { name: string; response: { result: string } } }> = [];
      lastToolResults = [];

      for (const part of functionCalls) {
        const { name, args } = part.functionCall!;
        agentLogger.info({ functionCall: name, args }, "Executing tool");

        const toolResult = await executeTool(name, args as Record<string, unknown>, context);
        toolLogger.info({ tool: name, result: toolResult.slice(0, 100) }, "Tool executed");

        functionCallParts.push({ functionCall: { name, args } });
        functionResponseParts.push({
          functionResponse: { name, response: { result: toolResult } },
        });
        lastToolResults.push(toolResult);
      }

      currentContents = [
        ...currentContents,
        { role: "model" as const, parts: functionCallParts },
        { role: "user" as const, parts: functionResponseParts },
      ];

      response = await ai.models.generateContent({
        model: config.gemini.model,
        contents: currentContents,
        config: {
          systemInstruction: systemPrompt,
          tools: [{ functionDeclarations: activeTools }],
        },
      });
    }

    let reply: string;

    if (lastToolResults.length > 0) {
      reply = aggregateToolResults(lastToolResults);
    } else if (response.text && response.text.trim() !== "") {
      reply = response.text;
    } else {
      reply = "Desculpe, não entendi. Pode reformular?";
    }

    addToHistory(context, "model", reply);

    agentLogger.info({ iterations }, "Finished processing message");
    return reply;
  } catch (error) {
    agentLogger.error({ error }, "Error processing message");
    throw error;
  }
}
