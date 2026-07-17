// main.js — 最终创建者，从模块链末端导入增强后的 createStateStack
// 节点可直接运行: node implementations/v3/refineDemo/main.js

import { createStateStack } from './moduleB.js';

const ss = createStateStack({
    state: {
        status: ['start', 'end'],
        resultData: {},
        extra: {},
    },

    peek: (peek) => peek(),
    push: (push, data) => { push(data); },
    pop: (pop, writeResultData) => {
        writeResultData({ done: true });
        pop();
    },

    statusDispatcher: (peek, status) => status,

    start: (state, peek, api) => {
        console.log('[start] pushing then popping...');
        api.switchStatus('end', { effect: 'push', param: ['hello'] });
    },

    end: (state, peek, api) => {
        console.log('[end] popping...');
        api.switchStatus(null, { effect: 'pop' });
    },

    init: (state, push) => {
        state.status = 'start';
    },
}, () => {
    console.log('[runParent] control returned to creator');
});

console.log('=== Starting (module chain: moduleA.pop + moduleB.push) ===');
ss.run();
console.log('=== Finished ===');
console.log('readState:', ss.readState());
