import { Client, LocalAuth } from "whatsapp-web.js";
import qrcode from "qrcode-terminal";
import { whatsappLogger } from "../utils/logger";

export function createWhatsAppClient() {
  const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--disable-gpu",
        "--single-process",
      ],
    },
  });

  client.on("qr", (qr) => {
    whatsappLogger.info("QR Code received - scan with WhatsApp");
    qrcode.generate(qr, { small: true }, (ascii) => {
      console.log(ascii);
    });
  });

  client.on("ready", () => {
    whatsappLogger.info("WhatsApp client connected and ready");
  });

  client.on("authenticated", () => {
    whatsappLogger.info("WhatsApp authenticated successfully");
  });

  client.on("auth_failure", (msg) => {
    whatsappLogger.error({ msg }, "WhatsApp authentication failed");
  });

  client.on("disconnected", (reason) => {
    whatsappLogger.warn({ reason }, "WhatsApp disconnected");
  });

  return client;
}
