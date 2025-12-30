import { createWhatsAppClient } from "./clients/whatsapp";
import { processMessage } from "./agent";
import { getOrCreateUser } from "./services/users";
import { ensureMember } from "./services/groups";
import { logger } from "./utils/logger";
import type { MessageContext } from "./types";
import type { Chat } from "whatsapp-web.js";

const client = createWhatsAppClient();

client.on("message", async (msg) => {
  try {
    const isGroup = msg.from.includes("@g.us");

    let phone: string;
    let groupId: string | undefined;
    let groupName: string | undefined;
    let chat: Chat;

    // Obtém o chat uma única vez
    try {
      chat = await msg.getChat();
    } catch {
      return; // Se não conseguir obter o chat, ignora
    }

    if (isGroup) {
      // Em grupos: só responde se a mensagem começar com "Jurandir"
      const messageText = msg.body.trim();
      const startsWithJurandir = /^jurandir/i.test(messageText);

      if (!startsWithJurandir) {
        return; // Ignora mensagens que não começam com "Jurandir"
      }

      // Remove "Jurandir" do início da mensagem para processar o resto
      msg.body = messageText.replace(/^jurandir[,:]?\s*/i, "").trim();

      // Se sobrou mensagem vazia, ignora
      if (!msg.body) {
        return;
      }

      // Em grupos: msg.from = ID do grupo, msg.author = ID do usuário
      groupId = msg.from;

      // author pode ser undefined em algumas situações, fallback para from
      const authorId = msg.author || msg.from;
      phone = authorId.replace(/@(c\.us|lid|s\.whatsapp\.net)$/, "");

      // Nome do grupo
      groupName = chat.name;

      logger.info({ groupId, phone, groupName, message: msg.body }, "Group message received");
    } else {
      // Em privado: msg.from = ID do usuário
      phone = msg.from.replace(/@(c\.us|lid)$/, "");
      logger.info({ phone, message: msg.body, from: msg.from }, "Private message received");
    }

    const name = (msg as any)._data?.notifyName || null;
    const user = await getOrCreateUser(phone, name);

    // Se for grupo, registra o usuário como membro
    if (isGroup && groupId) {
      await ensureMember(groupId, user.id, groupName);
      logger.info({ groupId, userId: user.id }, "User registered as group member");
    }

    // Monta o contexto
    const context: MessageContext = {
      userId: user.id,
      groupId,
      isGroup,
    };

    // Mostra "digitando..." enquanto processa
    await chat.sendStateTyping();

    // Processa a mensagem com o agente
    const reply = await processMessage(msg.body, context);

    if (reply) {
      // Calcula delay baseado no tamanho da resposta (simula digitação)
      // Mínimo 500ms, máximo 3000ms
      const typingDelay = Math.min(3000, Math.max(500, reply.length * 10));
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
