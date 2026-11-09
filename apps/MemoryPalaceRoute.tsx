/**
 * 记忆宫殿路由入口。
 *
 * 只做一件事：把真实的 MemoryPalaceApp 包进错误垉。
 * 这样即使某条脏数据把渲染搞垮，崩的也只是这块区域，
 * 外层导航、对话和其他应用都还在。
 *
 * 真实逻辑仍然是 apps/MemoryPalaceApp.tsx，没有搬动任何业务代码。
 * 用静态 import 而非 lazy，避免影响新手引导的展开状态。
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
