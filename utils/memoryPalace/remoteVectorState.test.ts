import { describe, expect, it } from 'vitest';
import { resolveRemoteVectorInitialized } from './remoteVectorState';

describe('resolveRemoteVectorInitialized', () => {
    const baseConfig = {
        enabled: true,
        initialized: true,
        supabaseUrl: 'https://demo.supabase.co',
        supabaseAnonKey: 'anon-key',
        compatShared: false,
    };

    it('returns true after a successful [ok] test result', () => {
        expect(
            resolveRemoteVectorInitialized(
                { ...baseConfig, initialized: false, enabled: false },
                { supabaseUrl: 'https://other.supabase.co', supabaseAnonKey: 'other-key', compatShared: true },
                '[ok]连接成功',
            ),
        ).toBe(true);
    });

    it('keeps initialized when saving unchanged initialized config without retest', () => {
        expect(
            resolveRemoteVectorInitialized(
                baseConfig,
                { supabaseUrl: 'https://demo.supabase.co', supabaseAnonKey: 'anon-key', compatShared: false },
                '',
            ),
        ).toBe(true);
    });

    it('requires retest when supabase endpoint changes', () => {
        expect(
            resolveRemoteVectorInitialized(
                baseConfig,
                { supabaseUrl: 'https://next.supabase.co', supabaseAnonKey: 'anon-key', compatShared: false },
                '',
            ),
        ).toBe(false);
    });

    it('requires retest when compat mode changes', () => {
        expect(
            resolveRemoteVectorInitialized(
                baseConfig,
                { supabaseUrl: 'https://demo.supabase.co', supabaseAnonKey: 'anon-key', compatShared: true },
                '',
            ),
        ).toBe(false);
    });
});
