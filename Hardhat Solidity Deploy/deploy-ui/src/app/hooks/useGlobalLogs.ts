'use client';

import { useEffect, useCallback, useState } from 'react';

// Types stricts pour les logs
export interface LogEvent {
  id: string;
  message: string;
  timestamp: string;
  source: string;
  level: 'info' | 'success' | 'error' | 'warn';
  metadata?: Record<string, any>;
}

// Niveaux de log avec emojis et couleurs CSS
export const LOG_LEVELS = {
  info: { emoji: '📝', color: 'text-zinc-400' },
  success: { emoji: '✅', color: 'text-emerald-400' },
  error: { emoji: '❌', color: 'text-red-400' },
  warn: { emoji: '⚠️', color: 'text-orange-400' }
} as const;

// Event Emitter singleton (state persistant)
class GlobalLogEmitter {
  private callbacks: ((log: LogEvent) => void)[] = [];
  private logHistory: LogEvent[] = [];

  emit(message: string, options: Partial<Omit<LogEvent, 'id' | 'timestamp'>> = {}) {
    const log: LogEvent = {
      id: crypto.randomUUID(),
      message,
      timestamp: new Date().toLocaleTimeString('fr-FR', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      }),
      source: options.source || 'global',
      level: options.level || 'info',
      metadata: options.metadata
    };

    // Stockage local (max 500 logs)
    this.logHistory = [...this.logHistory, log].slice(-500);
    
    // Broadcast à tous les subscribers
    this.callbacks.forEach(callback => callback(log));
    
    // Console avec formatage coloré
    const levelInfo = LOG_LEVELS[log.level];
    console.log(`%c${levelInfo.emoji} %c[${log.timestamp}] %c[${log.source}] %c${log.message}`,
      `color: ${levelInfo.color}; font-weight: bold`,
      'color: #94a3b8; font-weight: bold',
      'color: #64748b; font-weight: bold',
      levelInfo.color
    );
  }

  subscribe(callback: (log: LogEvent) => void) {
    this.callbacks.push(callback);
    // Envoie 50 derniers logs au nouveau subscriber
    this.logHistory.slice(-50).forEach(callback);
  }

  unsubscribe(callback: (log: LogEvent) => void) {
    this.callbacks = this.callbacks.filter(cb => cb !== callback);
  }

  clear() {
    this.logHistory = [];
  }

  getHistory() {
    return this.logHistory;
  }
}

// Instance singleton
export const globalLogEmitter = new GlobalLogEmitter();

// 🎯 HOOK PRINCIPAL : Logs globaux + locaux (ce que tu veux !)
export const useDualLogs = (source: string) => {
  const [localLogs, setLocalLogs] = useState<LogEvent[]>([]);

  const addLog = useCallback((
    message: string, 
    options: Partial<Omit<LogEvent, 'id' | 'timestamp' | 'source'>> = {}
  ) => {
    // 1️⃣ GLOBAL (Live Logs page + console)
    globalLogEmitter.emit(message, { source, ...options });
    
    // 2️⃣ LOCAL (composant)
    const localLog: LogEvent = {
      id: crypto.randomUUID(),
      message,
      timestamp: new Date().toLocaleTimeString('fr-FR'),
      source,
      level: (options as any).level || 'info'
    };
    setLocalLogs(prev => [...prev.slice(-50), localLog]); // Max 50 logs locaux
  }, [source]);

  const clearLocalLogs = useCallback(() => setLocalLogs([]), []);

  return { 
    logs: localLogs, 
    addLog, 
    clearLocalLogs 
  };
};

// 📡 Hook pour ÉMETTRE SEULEMENT global (sans local)
export const useEmitLog = () => {
  return useCallback((message: string, options: Partial<Omit<LogEvent, 'id' | 'timestamp'>> = {}) => {
    globalLogEmitter.emit(message, options);
  }, []);
};

// 👂 Hook pour RÉCEPTION globale (Live Logs page)
export const useGlobalLogs = (onLog: (log: LogEvent) => void) => {
  useEffect(() => {
    globalLogEmitter.subscribe(onLog);
    return () => globalLogEmitter.unsubscribe(onLog);
  }, [onLog]);
};

// Helpers pratiques
export const emitSuccess = (message: string, source: string) =>
  globalLogEmitter.emit(message, { source, level: 'success' });

export const emitError = (message: string, source: string) =>
  globalLogEmitter.emit(message, { source, level: 'error' });

export const emitInfo = (message: string, source: string) =>
  globalLogEmitter.emit(message, { source, level: 'info' });

export const emitWarn = (message: string, source: string) =>
  globalLogEmitter.emit(message, { source, level: 'warn' });

// 📜 Hook historique global
export const useLogHistory = () => {
  const [history, setHistory] = useState<LogEvent[]>([]);
  useEffect(() => {
    const update = (log: LogEvent) => {
      setHistory(prev => [...prev.slice(-500), log]);
    };
    globalLogEmitter.subscribe(update);
    return () => globalLogEmitter.unsubscribe(update as any);
  }, []);
  return history;
};
