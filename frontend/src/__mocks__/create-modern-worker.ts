// Jest cannot parse `import.meta`, and jsdom has no workers. The hooks then calculate on the main thread
export const createModernWorker = (): Worker | null => null;
