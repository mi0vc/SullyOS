/**
 * 记忆宫殿路由入口。
 *
 * 只做一件事：把真实的 MemoryPalaceApp 包进错误垉。
 * 这样即使某条脏数据把渲染搞垮，崩的也只是这块区域，
 * 外层导航、对话和其他应用都还在。
 *
 * 真实逻辑仍然是 apps/MemoryPalaceApp.tsx，没有搬动任何业务代码。
 * 注意：这里用静态 import，不用 lazy，
 * 否则一、二、三号新手引导的展开状态可能被 Suspense 打断。
 */

import React from 'react';
import MemoryPalaceBoundary from '../components/MemoryPalaceBoundary';
import MemoryPalaceApp from './MemoryPalaceApp';

export default function MemoryPalaceRoute() {
    return (
        <MemoryPalaceBoundary label="记忆宫殿">
            <MemoryPalaceApp />
        </MemoryPalaceBoundary>
    );
}
