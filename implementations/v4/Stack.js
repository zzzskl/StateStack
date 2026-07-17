// Stack.js — stateStackPrototype 工厂
// 提供 simplest 级别的完整 stateStackPrototype，原始栈为内部实现细节

export function createStateStackPrototype() {
    // ── 内部原始栈 ──
    const items = [];
    const stack = {
        push(item) { items.push(item); },
        pop()       { return items.pop(); },
        peek()      { return items[items.length - 1]; },
    };

    const state = {
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
        push(data) { stack.push(data); },

        // ── 写操作（simplest） ──
        writeResultData(value) { state.resultData = value; },
        writeExtra(value)      { state.extra = value; },

        // ── 状态切换（simplest） ──
        switchStatus(nextStatus) { state.status = nextStatus; },

        // ── 运行（空桩，由 instanceRunningScope 覆盖） ──
        run() {},
    };
}
