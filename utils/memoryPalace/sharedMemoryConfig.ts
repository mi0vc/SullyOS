import type { SharedMemoryConfig } from './sharedMemory';

const KEY = 'sullyos.shared.memory.config';

const EMPTY_CONFIG: SharedMemoryConfig = {
    endpoint: undefined,
    personaBindings: {},
};

export function sharedMemoryConfigKey(): string { return KEY; }

function normalizeConfig(input: unknown): SharedMemoryConfig {
    const parsed = (input && typeof input === 'object') ? input as Record<string, unknown> : {};
    const bindingsInput = parsed.personaBindings;
    const personaBindings: Record<string, string> = {};
    if (bindingsInput && typeof bindingsInput === 'object') {
        for (const [charId, personaId] of Object.entries(bindingsInput as Record<string, unknown>)) {
            if (typeof charId !== 'string' || typeof personaId !== 'string') continue;
            const c = charId.trim();
            const p = personaId.trim();
            if (!c || !p) continue;
            personaBindings[c] = p;
        }
    }
    const endpoint = typeof parsed.endpoint === 'string' && parsed.endpoint.trim() ? parsed.endpoint.trim() : undefined;
    return { endpoint, personaBindings };
}

export function getSharedMemoryConfig(): SharedMemoryConfig {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return { ...EMPTY_CONFIG, personaBindings: {} };
        return normalizeConfig(JSON.parse(raw));
    } catch {
        return { ...EMPTY_CONFIG, personaBindings: {} };
    }
}

export function updateSharedMemoryConfig(config: Partial<SharedMemoryConfig>): SharedMemoryConfig {
    const current = getSharedMemoryConfig();
    const next = normalizeConfig({ ...current, ...config });
    localStorage.setItem(KEY, JSON.stringify(next));
    return next;
}

export function getSharedPersonaBinding(charId: string): string | null {
    const id = (charId || '').trim();
    if (!id) return null;
    return getSharedMemoryConfig().personaBindings[id] || null;
}

export function setSharedPersonaBinding(charId: string, personaId: string): SharedMemoryConfig {
    const id = (charId || '').trim();
    if (!id) return getSharedMemoryConfig();
    const cfg = getSharedMemoryConfig();
    const bindings = { ...cfg.personaBindings };
    const nextPersona = (personaId || '').trim();
    if (nextPersona) bindings[id] = nextPersona;
    else delete bindings[id];
    return updateSharedMemoryConfig({ ...cfg, personaBindings: bindings });
}
