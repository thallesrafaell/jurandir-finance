import { createWhatsAppClient } from "./clients/whatsapp";
import { processMessage } from "./agent";
import { getOrCreateUser } from "./services/users";
import { ensureMember } from "./services/groups";
import { logger } from "./utils/logger";
import type { MessageContext } from "./types";
import type { Chat } from "whatsapp-web.js";

const JURANDIR_PATTERN = /^jurandir[,:]?\s*/i;

function extractPhoneFromId(id: string): string {
  return id.replace(/@(c\.us|lid|s\.whatsapp\.net)$/, "");
}

function calculateTypingDelay(text: string): number {
  return Math.min(3000, Math.max(500, text.length * 10));
}

const client = createWhatsAppClient();

client.on("message", async (msg) => {
  try {
    const isGroup = msg.from.includes("@g.us");

    let chat: Chat;
    try {
      chat = await msg.getChat();
    } catch {
      return;
    }

    let phone: string;
    let groupId: string | undefined;
    let groupName: string | undefined;

    if (isGroup) {
      const messageText = msg.body.trim();
      if (!JURANDIR_PATTERN.test(messageText)) return;

      msg.body = messageText.replace(JURANDIR_PATTERN, "").trim();
      if (!msg.body) return;

      groupId = msg.from;
      const authorId = msg.author || msg.from;
      phone = extractPhoneFromId(authorId);
      groupName = chat.name;

      logger.info({ groupId, phone, groupName, message: msg.body }, "Group message received");
    } else {
      phone = extractPhoneFromId(msg.from);
      logger.info({ phone, message: msg.body, from: msg.from }, "Private message received");
    }

    const name = (msg as any)._data?.notifyName || null;
    const user = await getOrCreateUser(phone, name);

    if (isGroup && groupId) {
      await ensureMember(groupId, user.id, groupName);
      logger.info({ groupId, userId: user.id }, "User registered as group member");
    }

    const context: MessageContext = {
      userId: user.id,
      groupId,
      isGroup,
    };

    await chat.sendStateTyping();

    const reply = await processMessage(msg.body, context);

    if (reply) {
      const typingDelay = calculateTypingDelay(reply);
      await new Promise((resolve) => setTimeout(resolve, typingDelay));

      logger.info({ phone, isGroup, reply: reply.slice(0, 100) }, "Sending reply");
      await msg.reply(reply);
    }
  } catch (error) {
    const err = error instanceof Error ? { message: error.message, stack: error.stack } : error;
    logger.error({ err, from: msg.from }, "Error processing message");
    console.error("Full error:", error);
    await msg.reply("Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.");
  }
});

client.initialize();

logger.info("Jurandir Finance Agent starting...");
