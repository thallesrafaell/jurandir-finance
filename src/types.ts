/**
 * Contexto da mensagem - pode ser privado ou de grupo
 */
export interface MessageContext {
  userId: string;
  groupId?: string;
  isGroup: boolean;
}
