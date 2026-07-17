// childDemo.js — 子栈全生命周期演示
// 节点可直接运行: node implementations/v3/childDemo.js

import { createStateStack } from './createStateStack.js';

const ss = createStateStack({
    state: {
        status: ['idle', 'createChild', 'runChild', 'readChild', 'destroyChild', 'done'],
        resultData: {},
        extra: {},
    },

    peek: function (peek) { return peek(); },
    push: function (push, data) { push(data); },
    pop: function (pop, writeResultData) { pop(); },

    statusDispatcher: function (peek, status) { return status; },

    idle: function (state, peek, api) {
        console.log('[parent:idle] switching to createChild');
        api.switchStatus('createChild');
    },

    createChild: function (state, peek, api) {
        console.log('[parent:createChild] creating child stack "child1"');
        api.createChildStateStack({
            state: {
                status: ['waiting', 'processing'],
                resultData: {},
                extra: {},
            },

            peek: function (peek) { return peek(); },
            push: function (push, data) {
                console.log('[child:push] received data:', data);
                push(data);
            },
            pop: function (pop, writeResultData) {
                writeResultData({ handled: true });
                pop();
            },

            statusDispatcher: function (peek, status) { return status; },

            waiting: function (state, peek, api) {
                console.log('[child:waiting] switching to processing');
                api.switchStatus('processing');
            },

            processing: function (state, peek, api) {
                console.log('[child:processing] work done, returning control to parent');
                api.writeResultData({ childResult: 'ok' });
                api.switchStatus(null, { effect: 'run' });
            },

            init: function (state, push) {
                console.log('[child:init] status set to waiting');
                state.status = 'waiting';
            },
        }, 'child1');

        console.log('[parent:createChild] child created, switching to runChild');
        api.switchStatus('runChild');
    },

    runChild: function (state, peek, api) {
        console.log('[parent:runChild] transferring control to child1');
        api.switchStatus('readChild', { effect: 'run', param: ['child', 'child1'] });
    },

    readChild: function (state, peek, api) {
        const childState = api.childStateStack('child1').readState();
        console.log('[parent:readChild] child state:', childState);

        console.log('[parent:readChild] switching to destroyChild');
        api.switchStatus('destroyChild');
    },

    destroyChild: function (state, peek, api) {
        console.log('[parent:destroyChild] destroying child1');
        api.childStateStack('child1').destroy();

        console.log('[parent:destroyChild] switching to done');
        api.switchStatus('done');
    },

    done: function (state, peek, api) {
        console.log('[parent:done] all done, returning to creator');
        api.switchStatus(null, { effect: 'run' });
    },

    init: function (state, push) {
        console.log('[parent:init] status set to idle');
        state.status = 'idle';
    },
}, function () {
    console.log('[runParent] control returned to creator');
});

console.log('=== Starting ChildDemo ===');
ss.run();
console.log('=== ChildDemo finished ===');
console.log('readState:', ss.readState());

// ── destroy 行为验证 ──
console.log('=== Destroy test ===');
ss.destroy();
console.log('destroy #1: ok (no error)');
ss.destroy();
console.log('destroy #2: ok (idempotent, no error)');

let testPassed = true;
try { ss.run(); testPassed = false; console.log('FAIL: ss.run() should throw after destroy'); } catch (e) { console.log('ss.run after destroy:', e.message); }
try { ss.readState(); testPassed = false; console.log('FAIL: ss.readState() should throw after destroy'); } catch (e) { console.log('ss.readState after destroy:', e.message); }
try { ss.push('x'); testPassed = false; console.log('FAIL: ss.push() should throw after destroy'); } catch (e) { console.log('ss.push after destroy:', e.message); }

if (testPassed) {
    console.log('Destroy behavior: ALL PASS');
} else {
    console.log('Destroy behavior: FAILED');
}
