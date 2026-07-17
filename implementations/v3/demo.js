// demo.js — 任务队列状态机
// 演示 push / pop / run 三种 effect 的实际语义，以及 runParent 控制流回传
// 节点可直接运行: node implementations/v3/demo.js

import { createStateStack } from './createStateStack.js';

const ss = createStateStack({
    state: {
        status: ['idle', 'processing', 'done'],
        resultData: {},
        extra: {},
    },

    // definition.peek 自身即实现，不返回新函数。参数 simplePeek 是模块链加强后的 peek
    peek: (peek) => {
        return peek();
    },

    // definition.push 自身即实现。参数 (simplePush, data) 由库传入
    push: (push, data) => {
        console.log('[push] pushing task:', data);
        push(data);
    },

    // definition.pop 自身即实现。参数 (simplePop, writeResultData) 由库传入
    pop: (pop, writeResultData) => {
        const task = pop();
        writeResultData({ task: task, processedAt: Date.now() });
        console.log('[pop] popped task, wrote resultData');
    },

    statusDispatcher: (peek, status) => status,

    idle: (state, peek, api) => {
        console.log('[idle] no task yet — pushing then switching to processing');
        api.switchStatus('processing', { effect: 'push', param: ['task-001'] });
    },

    processing: (state, peek, api) => {
        const top = peek();
        console.log('[processing] processing task from stack top:', top);
        api.switchStatus('done', { effect: 'pop' });
    },

    done: (state, peek, api) => {
        console.log('[done] task processed, returning control to parent');
        api.switchStatus(null, { effect: 'run' });
    },

    init: (state, push) => {
        state.status = 'idle';
        console.log('[init] status set to idle');
    },
}, () => {
    // runParent — 控制流回传到这里
    console.log('[runParent] control flow returned to creator');
});

console.log('=== Starting StateStack ===');
ss.run();
console.log('=== StateStack finished ===');
console.log('readState:', ss.readState());
