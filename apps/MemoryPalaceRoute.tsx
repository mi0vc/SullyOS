/**
 * 记忆宫殿路由入口：用错误垉包住真实页面。
 * 真实逻辑仍在 apps/MemoryPalaceApp.tsx。
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
