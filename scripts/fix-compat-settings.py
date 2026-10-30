from pathlib import Path
p=Path('apps/MemoryPalaceApp.tsx')
s=p.read_text()
old="""    const handleSaveRemoteVector = () => {
        const initialized = rvTestResult.startsWith('[ok]');
        updateRemoteVectorConfig({ enabled: true, supabaseUrl: rvUrl, supabaseAnonKey: rvKey, initialized, compatShared:rvCompat });
        addToast('远程向量存储配置已保存', 'success');
    };"""
new="""    const handleSaveRemoteVector = async () => {
        try {
            const nextConfig = { enabled: true, supabaseUrl: rvUrl.trim(), supabaseAnonKey: rvKey.trim(), initialized: rvTestResult.startsWith('[ok]'), compatShared: rvCompat };
            if (rvCompat) {
                if (!activeCharacterId) throw new Error('请先选择角色');
                if (rvEmail || rvPassword) {
                    if (!rvEmail || !rvPassword) throw new Error('请填写完整的共享库邮箱和密码');
                    await compatLogin(nextConfig, rvEmail.trim(), rvPassword);
                    setRvPassword('');
                }
                bindCompat(activeCharacterId, rvPersona.trim(), nextConfig);
                if (readCompatBinding(activeCharacterId, nextConfig) !== rvPersona.trim()) throw new Error('角色绑定保存失败');
            }
            updateRemoteVectorConfig(nextConfig);
            addToast(nextConfig.initialized ? '远程向量存储配置已保存' : '配置已保存，请测试连接后启用远程读写', nextConfig.initialized ? 'success' : 'info');
        } catch (e: any) {
            addToast('保存失败：' + e.message, 'error');
        }
    };"""
if old in s:
    assert s.count(old)==1
    p.write_text(s.replace(old,new))
else:
    assert new in s, 'Unexpected app source; refusing to patch'
p=Path('utils/memoryPalace/sullyosCompat.test.ts')
s=p.read_text()
extra="""
it('blank URL does not crash settings',()=>expect(readCompatBinding('a',{...c,supabaseUrl:''})).toBe(''));
it('incomplete URL does not crash settings',()=>expect(readCompatBinding('a',{...c,supabaseUrl:'https://'})).toBe(''));
it('saved role survives re-reading configuration',()=>{bindCompat('a',p,c);expect(readCompatBinding('a',{...c})).toBe(p);});
"""
if extra not in s: p.write_text(s+extra)
