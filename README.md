# Jurandir Finance

> Assistente financeiro pessoal e de grupo com inteligência artificial para WhatsApp

[![Bun](https://img.shields.io/badge/Bun-1.3.3+-000000?style=flat-square&logo=bun)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-7.2-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![Google Gemini](https://img.shields.io/badge/Gemini-2.5_Flash-4285F4?style=flat-square&logo=google)](https://ai.google.dev/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker)](https://www.docker.com/)

O **Jurandir** é um chatbot inteligente que ajuda você a gerenciar suas finanças pessoais e de grupo diretamente pelo WhatsApp. Usando processamento de linguagem natural com Google Gemini, ele entende suas mensagens e registra despesas, receitas, investimentos e orçamentos automaticamente.

## Funcionalidades

### Finanças Pessoais
- **Controle de Despesas** - Registre, edite, delete e liste gastos com categorias automáticas
- **Controle de Receitas** - Acompanhe múltiplas fontes de renda
- **Orçamentos** - Defina limites mensais por categoria e acompanhe o progresso
- **Investimentos** - Monitore seus investimentos e calcule retornos
- **Relatórios** - Gere relatórios completos com balanço financeiro

### Finanças em Grupo
- **Despesas Compartilhadas** - Registre gastos para membros específicos do grupo
- **Divisão de Contas** - Calcule automaticamente quem deve quanto para quem
- **Relatórios de Grupo** - Visualize o panorama financeiro do grupo

### Experiência
- **Linguagem Natural** - Fale normalmente, o Jurandir entende
- **Categorização Automática** - Não precisa especificar categoria, a IA deduz
- **Histórico de Conversas** - Mantém contexto para interações naturais
- **Indicador de Digitação** - Mostra quando está processando sua mensagem

## Tecnologias

| Camada | Tecnologia |
|--------|------------|
| Runtime | [Bun](https://bun.sh) |
| Linguagem | TypeScript 5.x |
| IA | Google Gemini 2.5 Flash Lite |
| WhatsApp | whatsapp-web.js |
| ORM | Prisma 7.2 |
| Banco de Dados | PostgreSQL (Neon Serverless) |
| Logs | Pino |
| Validação | Zod |
| Container | Docker |

## Pré-requisitos

- [Bun](https://bun.sh) v1.3.3 ou superior
- Conta no [Google AI Studio](https://aistudio.google.com/) para API key do Gemini
- Banco de dados PostgreSQL (recomendado: [Neon](https://neon.tech))
- Conta no WhatsApp para autenticação

## Instalação

### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/jurandir-finance.git
cd jurandir-finance
```

### 2. Instale as dependências

```bash
bun install
```

### 3. Configure as variáveis de ambiente

```bash
cp .env.example .env
```

Edite o arquivo `.env`:

```env
DATABASE_URL="postgresql://user:password@host/database?sslmode=require"
GEMINI_API_KEY="sua-chave-api-do-gemini"
```

### 4. Configure o banco de dados

```bash
bun run db:generate  # Gera o cliente Prisma
bun run db:push      # Sincroniza o schema com o banco
```

### 5. Inicie o bot

```bash
bun run dev
```

Na primeira execução, escaneie o QR Code com seu WhatsApp para autenticar.

## Como Usar

### Conversas Privadas

Envie mensagens diretamente para o número do bot. Exemplos:

```
Gastei 50 reais no mercado
Recebi 3000 de salário
Quanto gastei esse mês?
Me mostra o relatório completo
Investi 1000 em bitcoin
Define orçamento de 500 para alimentação
```

### Em Grupos

Mencione o Jurandir no início da mensagem:

```
Jurandir, gastei 100 no almoço
Jurandir, quanto o grupo gastou?
Jurandir, quem deve quanto pra quem?
```

### Comandos Úteis

| Ação | Exemplo |
|------|---------|
| Registrar despesa | "Gastei 50 no mercado" |
| Registrar receita | "Recebi 2000 de freelance" |
| Ver despesas | "Lista minhas despesas" |
| Ver receitas | "Mostra minhas receitas" |
| Resumo financeiro | "Qual meu saldo?" |
| Relatório completo | "Me dá o relatório" |
| Definir orçamento | "Orçamento de 800 pra transporte" |
| Status do orçamento | "Como tá meu orçamento?" |
| Registrar investimento | "Investi 5000 em ações" |
| Ver investimentos | "Como estão meus investimentos?" |
| Marcar como pago | "Marca o aluguel como pago" |
| Deletar despesa | "Deleta a despesa do mercado" |
| Editar despesa | "Muda o valor do almoço pra 45" |
| Divisão de grupo | "Quem deve quanto?" |

### Categorias de Despesas

| Categoria | Exemplos |
|-----------|----------|
| Alimentação | Mercado, restaurante, lanche |
| Transporte | Uber, gasolina, ônibus |
| Moradia | Aluguel, condomínio, luz |
| Saúde | Remédio, consulta, plano |
| Lazer | Cinema, viagem, show |
| Educação | Curso, livro, faculdade |
| Vestuário | Roupa, sapato, acessório |
| Cartões | Fatura do cartão |
| Empréstimo | Parcela, financiamento |
| Outros | Diversos |

### Fontes de Receita

- Salário
- Freelance
- Investimentos
- Presente
- Outros

### Tipos de Investimento

- Ações (stocks)
- Criptomoedas (crypto)
- Renda Fixa (fixed_income)
- Fundos (funds)
- Outros (other)

## Estrutura do Projeto

```
jurandir-finance/
├── src/
│   ├── index.ts              # Ponto de entrada principal
│   ├── types.ts              # Definições de tipos
│   ├── agent/
│   │   ├── index.ts          # Orquestração do agente IA
│   │   ├── tools.ts          # Definição das 26+ ferramentas
│   │   └── prompts.ts        # Prompts do sistema
│   ├── clients/
│   │   ├── whatsapp.ts       # Cliente WhatsApp Web
│   │   └── gemini.ts         # Cliente Google Gemini
│   ├── services/
│   │   ├── users.ts          # Gerenciamento de usuários
│   │   ├── expenses.ts       # Gerenciamento de despesas
│   │   ├── income.ts         # Gerenciamento de receitas
│   │   ├── investments.ts    # Gerenciamento de investimentos
│   │   ├── budget.ts         # Gerenciamento de orçamentos
│   │   ├── groups.ts         # Gerenciamento de grupos
│   │   └── reports.ts        # Geração de relatórios
│   ├── db/
│   │   └── index.ts          # Cliente Prisma com Neon
│   ├── config/
│   │   └── index.ts          # Configurações
│   ├── utils/
│   │   └── logger.ts         # Logger Pino
│   ├── mcp/
│   │   └── server.ts         # Servidor MCP para Claude
│   └── types/
│       └── index.ts          # Tipos adicionais
├── prisma/
│   └── schema.prisma         # Schema do banco de dados
├── Dockerfile                # Imagem Docker
├── docker-compose.yml        # Configuração Docker Compose
└── .env.example              # Template de variáveis
```

## Arquitetura

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│                 │     │                  │     │                 │
│  WhatsApp Web   │────▶│  Jurandir Agent  │────▶│  Google Gemini  │
│                 │     │                  │     │                 │
└─────────────────┘     └────────┬─────────┘     └─────────────────┘
                                 │
                                 │
                        ┌────────▼─────────┐
                        │                  │
                        │  Services Layer  │
                        │                  │
                        └────────┬─────────┘
                                 │
                        ┌────────▼─────────┐
                        │                  │
                        │  PostgreSQL/Neon │
                        │                  │
                        └──────────────────┘
```

### Fluxo de Mensagens

1. Usuário envia mensagem no WhatsApp
2. `whatsapp-web.js` captura a mensagem
3. Agente verifica contexto (privado vs grupo)
4. Mensagem enviada ao Gemini com histórico
5. Gemini identifica intenção e chama ferramentas
6. Services executam operações no banco
7. Resposta formatada enviada ao usuário

## Deploy com Docker

### Docker Compose (Recomendado)

```bash
docker-compose up -d
```

O `docker-compose.yml` já está configurado com:
- Volumes para persistência da sessão WhatsApp
- Chromium pré-instalado para automação
- Variáveis de ambiente do `.env`

### Build Manual

```bash
docker build -t jurandir-finance .
docker run -d \
  --name jurandir \
  -v jurandir_auth:/app/.wwebjs_auth \
  -v jurandir_cache:/app/.wwebjs_cache \
  --env-file .env \
  jurandir-finance
```

## Scripts Disponíveis

| Script | Descrição |
|--------|-----------|
| `bun run dev` | Desenvolvimento com hot reload |
| `bun run start` | Produção |
| `bun run mcp` | Servidor MCP para Claude |
| `bun run db:generate` | Gera cliente Prisma |
| `bun run db:push` | Sincroniza schema |
| `bun run db:migrate` | Cria migration |
| `bun run db:studio` | Interface Prisma Studio |
| `bun test` | Executa testes |

## Variáveis de Ambiente

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `DATABASE_URL` | Sim | Connection string do PostgreSQL |
| `GEMINI_API_KEY` | Sim | Chave da API do Google Gemini |
| `LOG_LEVEL` | Não | Nível de log (debug, info, warn, error) |
| `NODE_ENV` | Não | Ambiente (development, production) |

## Integração MCP

O Jurandir expõe suas ferramentas via Model Context Protocol para integração com Claude:

```bash
bun run mcp
```

Ferramentas disponíveis:
- `add_expense` - Adicionar despesa
- `list_expenses` - Listar despesas
- `expenses_by_category` - Despesas por categoria
- `add_investment` - Adicionar investimento
- `investment_summary` - Resumo de investimentos
- `add_budget` - Definir orçamento
- `budget_status` - Status do orçamento

## Segurança

- Usuários identificados pelo número do WhatsApp
- Sessões persistidas localmente em `.wwebjs_auth`
- Conexões SSL obrigatórias com o banco
- Variáveis sensíveis em arquivo `.env` (não comitar)

## Contribuindo

1. Fork o projeto
2. Crie sua branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

## Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

Feito com Bun, Gemini e muito café
