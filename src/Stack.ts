// Stack.ts — stateStackPrototype 工厂
// 提供 simplest 级别的完整 stateStackPrototype，原始栈为内部实现细节

import type { InternalState } from './types.js';

interface StateStackPrototype {
    stack: { push(item: unknown): void; pop(): unknown; peek(): unknown };
    state: InternalState;
    peek(): unknown;
    pop(): unknown;
    push(data: unknown): void;
    writeResultData(value: unknown): void;
    writeExtra(value: unknown): void;
    switchStatus(nextStatus: unknown): void;
    run(): void;
}

export function createStateStackPrototype(): StateStackPrototype {
    // ── 内部原始栈 ──
    const items: unknown[] = [];
    const stack = {
        push(item: unknown) { items.push(item); },
        pop()       { return items.pop(); },
        peek()      { return items[items.length - 1]; },
    };

    const state: InternalState = {
        status: null,
        resultData: {},
        extra: {},
    };

    return {
        stack,
        state,

        // ── 栈操作（simplest，委托原始栈） ──
        peek()  { return stack.peek(); },
        pop()   { return stack.pop(); },
        push(data: unknown) { stack.push(data); },

        // ── 写操作（simplest） ──
        writeResultData(value: unknown) { state.resultData = value as Record<string, unknown>; },
        writeExtra(value: unknown)      { state.extra = value as Record<string, unknown>; },

        // ── 状态切换（simplest） ──
        switchStatus(nextStatus: unknown) { state.status = nextStatus as string | null; },

        // ── 运行（空桩，由 instanceRunningScope 覆盖） ──
        run() {},
    };
}
