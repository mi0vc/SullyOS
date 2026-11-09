/**
 * 记忆宫殿渲染垉。
 *
 * 历史教训：一条字段残缺的旧记忆就能让整个应用白屏（React #306），
 * 用户连「哪里坏了」都看不到。这里把崩溃收进卡片：
 * 页面壳还在，导航还能用，错误信息能展开看。
 */

import React from 'react';

type Props = {
    children: React.ReactNode;
    label?: string;
};

type State = {
    error: Error | null;
    info: string | null;
};

export class MemoryPalaceBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { error: null, info: null };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
        console.error('[记忆宫殿] 渲染出错', error, errorInfo);
        this.setState({ info: errorInfo?.componentStack || null });
    }

    private handleReset = (): void => {
        this.setState({ error: null, info: null });
    };

    private handleReload = (): void => {
        try { window.location.reload(); } catch { /* ignore */ }
    };

    render(): React.ReactNode {
        const { error, info } = this.state;
        if (!error) return this.props.children;

        const label = this.props.label || '记忆宫殿';
        const detail = [error.name, error.message, info].filter(Boolean).join('\n\n');

        return (
            <div
                role="alert"
                style={{
                    paddingTop: 'max(40px, calc(var(--safe-top) + 16px))',
                    paddingLeft: 16,
                    paddingRight: 16,
                    paddingBottom: 24,
                    minHeight: '100%',
                    background: '#faf8ff',
                    color: '#3b3355',
                    boxSizing: 'border-box',
                }}
            >
                <div
                    style={{
                        maxWidth: 560,
                        margin: '0 auto',
                        background: '#fff',
                        border: '1px solid #e9d5ff',
                        borderRadius: 18,
                        padding: '20px 18px',
                        boxShadow: '0 6px 24px rgba(124, 58, 237, 0.06)',
                    }}
                >
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#6d28d9', marginBottom: 8 }}>
                        {label}这块页面出了点问题
                    </div>
                    <div style={{ fontSize: 12, lineHeight: 1.7, color: '#6b7280', marginBottom: 14 }}>
                        其他页面和数据都没受影响，这里只是渲染没能完成。可以先重试一次；如果反复出现，把下面的报错发我。
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                        <button
                            type="button"
                            onClick={this.handleReset}
                            style={{
                                flex: 1,
                                border: 0,
                                borderRadius: 10,
                                padding: '10px 12px',
                                background: '#7c3aed',
                                color: '#fff',
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: 'pointer',
                            }}
                        >
                            重试
                        </button>
                        <button
                            type="button"
                            onClick={this.handleReload}
                            style={{
                                flex: 1,
                                border: '1px solid #e9d5ff',
                                borderRadius: 10,
                                padding: '10px 12px',
                                background: '#fff',
                                color: '#6d28d9',
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: 'pointer',
                            }}
                        >
                            刷新页面
                        </button>
                    </div>

                    <details>
                        <summary style={{ fontSize: 11, color: '#9ca3af', cursor: 'pointer' }}>报错详情</summary>
                        <pre
                            style={{
                                marginTop: 8,
                                padding: '10px 12px',
                                background: '#faf7ff',
                                border: '1px solid #f0e7ff',
                                borderRadius: 10,
                                fontSize: 10,
                                lineHeight: 1.6,
                                color: '#5b5270',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                maxHeight: 240,
                                overflow: 'auto',
                            }}
                        >
                            {detail}
                        </pre>
                    </details>
                </div>
            </div>
        );
    }
}

export default MemoryPalaceBoundary;
