from pathlib import Path
p=Path('apps/MemoryPalaceApp.tsx')
s=p.read_text()
old='    // 远程向量：关闭'
new="""    // Read cloud memories into the same local stores used by rooms and recall.
    const pullCloudMemories = useCallback(async () => {
        if (!activeCharacterId || !remoteVectorConfig.enabled || !remoteVectorConfig.initialized) return;
        setRvSyncing(true);
        try {
            const { pullRemoteMemories } = await import('../utils/memoryPalace/pullRemote');
            const result = await pullRemoteMemories(remoteVectorConfig, activeCharacterId);
            await loadStats();
            addToast(`云端记忆读取完成：新增 ${result.added} 条，已有 ${result.existing} 条`, 'success');
        } catch (e: any) { addToast(`云端记忆读取失败：${e.message}`, 'error'); }
        finally { setRvSyncing(false); }
    }, [activeCharacterId, remoteVectorConfig, loadStats]);
    useEffect(() => {
        if (remoteVectorConfig.compatShared && remoteVectorConfig.enabled && remoteVectorConfig.initialized) void pullCloudMemories();
    }, [pullCloudMemories]);

    // 远程向量：关闭"""
assert s.count(old)==1
s=s.replace(old,new)
old='                    {/* 已启用后的操作 */}'
new="""                    {remoteVectorConfig.enabled && remoteVectorConfig.initialized && <button className={inputClass} onClick={pullCloudMemories} disabled={rvSyncing}>{rvSyncing ? '正在读取云端记忆...' : '读取云端记忆到记忆宫殿'}</button>}
                    {/* 已启用后的操作 */}"""
assert s.count(old)==1
s=s.replace(old,new)
p.write_text(s)
