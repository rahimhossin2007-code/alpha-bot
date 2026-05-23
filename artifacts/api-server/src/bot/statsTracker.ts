export interface BotStats {
  messagesHandled: number;
  commandsExecuted: number;
  errorsCount: number;
}

const stats: BotStats = {
  messagesHandled: 0,
  commandsExecuted: 0,
  errorsCount: 0,
};

export function incrementMessages(): void {
  stats.messagesHandled++;
}

export function incrementCommands(): void {
  stats.commandsExecuted++;
}

export function incrementErrors(): void {
  stats.errorsCount++;
}

export function getStats(): BotStats {
  return { ...stats };
}

export function resetStats(): void {
  stats.messagesHandled = 0;
  stats.commandsExecuted = 0;
  stats.errorsCount = 0;
}
