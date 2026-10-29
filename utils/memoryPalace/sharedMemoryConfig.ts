import type { SharedMemoryConfig } from './sharedMemory';

const KEY = 'sullyos.shared.memory.config';
const DEFAULT_PERSONA = 'b7e95bab-1bd1-4e5b-89cc-7b6fc1bcf960';

export function sharedMemoryConfigKey(): string { return KEY; }
export function getSharedMemoryConfig(): SharedMemoryConfig {
    try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed?.personaId) return parsed as SharedMemoryConfig;
        }
    } catch { /* use default */ }
    return { personaId: DEFAULT_PERSONA };
}
export function updateSharedMemoryConfig(config: Partial<SharedMemoryConfig>): SharedMemoryConfig {
    const next = { ...getSharedMemoryConfig(), ...config };
    localStorage.setItem(KEY, JSON.stringify(next));
    return next;
}
