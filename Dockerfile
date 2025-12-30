# Usa imagem oficial do Bun com Debian
FROM oven/bun:1 AS base

# Instala dependências do Chromium para Puppeteer/WhatsApp Web.js
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Define variáveis de ambiente para o Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Copia arquivos de dependências
COPY package.json bun.lock* ./
COPY prisma ./prisma/

# Instala dependências
RUN bun install --frozen-lockfile

# Gera o Prisma Client
RUN bun run prisma generate

# Copia o resto do código
COPY . .

# Cria diretório para dados persistentes do WhatsApp
RUN mkdir -p /app/.wwebjs_auth /app/.wwebjs_cache

# Expõe volume para persistência da sessão do WhatsApp
VOLUME ["/app/.wwebjs_auth", "/app/.wwebjs_cache"]

# Comando para iniciar
CMD ["bun", "run", "src/index.ts"]
