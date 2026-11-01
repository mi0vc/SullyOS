import type { RemoteVectorConfig } from './types';

export function resolveRemoteVectorInitialized(
    currentConfig: RemoteVectorConfig,
    nextConfig: Pick<RemoteVectorConfig, 'supabaseUrl' | 'supabaseAnonKey' | 'compatShared'>,
    testResult: string,
): boolean {
    if (testResult.startsWith('[ok]')) return true;
    if (!currentConfig.enabled || !currentConfig.initialized) return false;
    if ((currentConfig.compatShared === true) !== (nextConfig.compatShared === true)) return false;
    if (currentConfig.supabaseUrl.trim() !== nextConfig.supabaseUrl.trim()) return false;
    if (currentConfig.supabaseAnonKey.trim() !== nextConfig.supabaseAnonKey.trim()) return false;
    return true;
}
