/**
 * 记忆宫殿路由入口。
 *
 * 只做一件事：把真实的 MemoryPalaceApp 包进错误垉。
 * 这样即使某条脏数据把渲染搞垮，崩的也只是这块区域，
 * 外层导航、对话和其他应用都还在。
 *
 * 真实逻辑仍然是 apps/MemoryPalaceApp.tsx，没有搬动任何业务代码。
 */

import React, { Suspense } from 'react';
import MemoryPalaceBoundary from '../components/MemoryPalaceBoundary';

const MemoryPalaceApp = React.lazy(() => import('./MemoryPalaceApp'));

function LoadingShell() {
    return (
        <div
            style={{
                paddingTop: 'max(40px, calc(var(--safe-top) + 16px))',
                paddingLeft: 16,
                paddingRight: 16,
                minHeight: '100%',
                background: '#faf8ff',
                color: '#9ca3af',
                fontSize: 12,
                boxSizing: 'border-box',
            }}
        >
            正在打开记忆宫殿…
        </div>
    );
}

export default function MemoryPalaceRoute() {
    return (
        <MemoryPalaceBoundary label="记忆宫殿">
            <Suspense fallback={<LoadingShell />}>
                <MemoryPalaceApp />
            </Suspense>
        </MemoryPalaceBoundary>
    );
}
