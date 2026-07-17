# Usage Guide

> This document contains complete usage examples and detailed explanations of StateStack. If this is your first time, we recommend reading the [Quick Start](../README.md) first.

---

## Installation

```bash
npm install state-stack
```

```js
import { createStateStack, refineCreateStateStack } from 'state-stack';
```

---

## Quick Start

### Example 1-1: Minimal State Machine (Getting Started)

Below is a minimal three-state (`idle → processing → done`) state machine. It demonstrates the full stack operation flow: **push → process → pop → finish**.

```js
import { createStateStack } from 'state-stack';

const ss = createStateStack({
    // ── state type declaration ──
    state: {
        status: ['idle', 'processing', 'done'],  // all possible status values
        resultData: { done: false },              // resultData field structure
    },

    // ── stack operation definitions ──
    peek: (peek) => peek(),                       // read stack top
    push: (push, data) => push(data),             // push to stack
    pop: (pop, writeResultData) => {              // pop + write result
        writeResultData({ done: true });
        pop();
    },

    // ── status dispatcher: decides which handler runs ──
    statusDispatcher: (peek, status) => status,

    // ── state handlers ──
    idle: (state, peek, api) => {
        api.switchStatus('processing', { effect: 'push', param: ['task-001'] });
    },
    processing: (state, peek, api) => {
        api.switchStatus('done', { effect: 'pop' });
    },
    done: (state, peek, api) => {
        api.switchStatus(null, { effect: 'run' }); // null status = end
    },

    // ── init (runs immediately on createStateStack()) ──
    init: (state, push) => { state.status = 'idle'; },
});

ss.run();
console.log(ss.readState()); // { status: null, resultData: { done: true } }
```

**Execution flow:**
```
init → status = 'idle'
  → idle handler: switchStatus('processing', push) → push 'task-001' onto stack
  → processing handler: switchStatus('done', pop) → pop stack
  → done handler: switchStatus(null, run) → finish
```

### Example 1-2: Returning Control with runParent

`effect: 'run'` can return control to the caller. The second parameter of `createStateStack`, `runParent`, is the callback that receives this control transfer.

```js
import { createStateStack } from 'state-stack';

const ss = createStateStack({
    state: {
        status: ['start', 'end'],                  // states: start → end → null
        resultData: { result: 'ok' },              // final { result: 'ok' }
    },
    peek: (peek) => peek(),
    push: (push, data) => push(data),
    pop: (pop, writeResultData) => {
        writeResultData({ result: 'ok' });
        pop();
    },
    statusDispatcher: (peek, status) => status,

    start: (state, peek, api) => {
        console.log('[start]');
        api.switchStatus('end', { effect: 'push', param: ['item'] });
    },
    end: (state, peek, api) => {
        console.log('[end]');
        api.switchStatus(null, { effect: 'run' }); // return control
    },

    init: (state, push) => { state.status = 'start'; },
}, () => {
    // runParent — when effect: 'run' is triggered, control returns here
    console.log('[runParent] control returned to creator');
});

console.log('=== run ===');
ss.run();
console.log('=== done ===');
// Output:
//   [start]
//   [end]
//   [runParent] control returned to creator
//   === done ===
```

---

## State Format Convention

The `state` field in StateStack is a **type documentation convention**. It does **not participate in initialization** — it purely tells the reader what states and fields the state machine has.

```js
state: {
    status: ['idle', 'processing', 'done'],   // ← list all possible status values
    resultData: { done: false },               // ← show the structure of resultData
}
```

| Field | Declaration Format | Runtime Type | Description |
|-------|-------------------|--------------|-------------|
| `status` | `string[]` (enum all status values) | `string \| null` | `null` = state machine terminated |
| `resultData` | `object` (show field structure) | `object` | Overwritten by `writeResultData()` |
| `extra` (optional) | `object` (show field structure) | `object` | Overwritten by `writeExtra()` |

**Runtime data flow example:**

```
init → state = { status: 'idle',     resultData: {} }
  → idle handler → switchStatus('processing', { effect: 'push' })
  → state = { status: 'processing', resultData: {} }
  → processing handler → writeResultData({ done: true }) → switchStatus(null, { effect: 'pop' })
  → state = { status: null,          resultData: { done: true } }   ← finished
```

> The `state` declaration format originates from design draft v1 — `status: []` means "the set of acceptable status values", `resultData: {}` means "the container for result data fields."
> This is analogous to TypeScript type annotations: declare the shape at definition time, fill in values at runtime.

---

## Core Concepts

### 1. `peek` — Reading the Stack Top

`peek` is the bridge between stack operations and the state machine. It appears in three places:
- **The `peek` field in the definition object**: custom read logic
- **The first parameter of `statusDispatcher`**: can sense the stack top when deciding state
- **The second parameter of a state handler**: can read the stack top when handling state

#### Example 2-1: peek Reading Stack Top Data

```js
const ss = createStateStack({
    state: {
        status: ['start', 'process'],              // states: start → process → null
        resultData: {},                             // no result written
    },
    peek: (peek) => {
        const top = peek();
        console.log('[peek] stack top:', top);
        return top;
    },
    push: (push, data) => push(data),
    pop: (pop) => pop(),
    statusDispatcher: (peek, status) => status,

    start: (state, peek, api) => {
        api.switchStatus('process', { effect: 'push', param: ['my-data'] });
    },
    process: (state, peek, api) => {
        const top = peek();               // read current stack top
        console.log('processing:', top);  // processing: my-data
        api.switchStatus(null, { effect: 'pop' });
    },

    init: (state, push) => { state.status = 'start'; },
});

ss.run();
```

#### Example 2-2: peek and statusDispatcher Working Together

The first parameter of `statusDispatcher` is `peek`. You can dynamically decide which state to enter based on the stack top element.

```js
const ss = createStateStack({
    state: {
        status: ['start', 'decide', 'fastTrack'],  // state flow
        resultData: {},                             // no result written
    },
    peek: (peek) => peek(),
    push: (push, data) => push(data),
    pop: (pop) => pop(),
    // Decide state based on stack top value
    statusDispatcher: (peek, status) => {
        const top = peek();
        if (top && top.type === 'urgent') return 'fastTrack';
        return status;
    },

    start: (state, peek, api) => {
        api.switchStatus('decide');
    },
    decide: (state, peek, api) => {
        api.switchStatus('fastTrack', { effect: 'push', param: [{ type: 'urgent', id: 1 }] });
    },
    fastTrack: (state, peek, api) => {
        console.log('[fastTrack] urgent task detected!');
        api.switchStatus(null, { effect: 'pop' });
    },

    init: (state, push) => { state.status = 'start'; },
});

ss.run();
```

---

### 2. `statusDispatcher` — State Dispatch

`statusDispatcher(peek, status)` is called each cycle and must return the name of the current state. The `status` parameter is the current state name (string or `null`). The return value is used as a key to look up the corresponding handler in the `definition`.

#### Example 2-3: Simple Dispatch Based on `status`

The most common usage — `switchStatus` directly writes the state, and `statusDispatcher` reads the current state name and returns it.

```js
const ss = createStateStack({
    state: {
        status: ['step1', 'step2'],                // states: step1 → step2 → null
        resultData: {},                             // no result written
    },
    peek: (peek) => peek(),
    push: (push, data) => push(data),
    pop: (pop) => pop(),
    statusDispatcher: (peek, status) => status,  // directly return the status name

    step1: (state, peek, api) => {
        api.switchStatus('step2');
    },
    step2: (state, peek, api) => {
        api.switchStatus(null, { effect: 'run' });
    },

    init: (state, push) => { state.status = 'step1'; },
});

ss.run();
```

#### Example 2-4: Custom Dispatch Based on `peek()`

You can make complex dispatch decisions based on stack top content, not just the current status name.

```js
const ss = createStateStack({
    state: {
        status: ['empty', 'processString', 'processNumber'],  // state flow
        resultData: {},                                        // no result written
    },
    peek: (peek) => peek(),
    push: (push, data) => push(data),
    pop: (pop) => pop(),
    statusDispatcher: (peek, status) => {
        const top = peek();
        if (!top) return 'empty';
        if (typeof top === 'number') return 'processNumber';
        if (typeof top === 'string') return 'processString';
        return status;
    },

    empty: (state, peek, api) => {
        api.switchStatus('processString', { effect: 'push', param: ['hello'] });
    },
    processString: (state, peek, api) => {
        console.log('string:', peek());  // string: hello
        api.switchStatus('processNumber', { effect: 'push', param: [42] });
    },
    processNumber: (state, peek, api) => {
        console.log('number:', peek());  // number: 42
        api.switchStatus(null, { effect: 'pop' });
    },

    init: (state, push) => { state.status = 'start'; },
});

ss.run();
```

---

### 3. `api.switchStatus()` + Effect — Driving Stack Operations

`switchStatus(nextStatus, effect?)` is the heart of the state machine:
- **`nextStatus`**: the state name for the next cycle (`null` means finish)
- **`effect`**: carries a stack operation descriptor

| Effect | Meaning |
|--------|---------|
| No `effect` | Pure state switch, no stack operation |
| `{ effect: 'push', param: [data] }` | Push `data` onto the stack |
| `{ effect: 'pop' }` | Pop the stack top |
| `{ effect: 'run' }` | Return control (triggers `runParent`) |
| `{ effect: 'run', param: ['child', id] }` | Run a specific child stack |

#### Example 2-5: `effect: 'push'` — Push

```js
const ss = createStateStack({
    state: {
        status: ['collect', 'summarize'],          // states: collect → summarize → null
        resultData: {},                             // no result written
    },
    peek: (peek) => peek(),
    push: (push, data) => { console.log('push:', data); push(data); },
    pop: (pop) => pop(),
    statusDispatcher: (peek, status) => status,

    collect: (state, peek, api) => {
        // batch push
        api.switchStatus('summarize', { effect: 'push', param: ['item1'] });
    },
    summarize: (state, peek, api) => {
        api.switchStatus(null, { effect: 'push', param: ['item2'] });
    },

    init: (state, push) => { state.status = 'collect'; },
});

ss.run();
// push: item1
// push: item2
```

#### Example 2-6: `effect: 'pop'` — Pop

```js
const ss = createStateStack({
    state: {
        status: ['start', 'process'],              // states: start → process → null
        resultData: { popped: 'task-X' },          // final { popped: 'task-X' }
    },
    peek: (peek) => peek(),
    push: (push, data) => push(data),
    pop: (pop, writeResultData) => {
        const popped = pop();
        writeResultData({ popped });
    },
    statusDispatcher: (peek, status) => status,

    start: (state, peek, api) => {
        api.switchStatus('process', { effect: 'push', param: ['task-X'] });
    },
    process: (state, peek, api) => {
        console.log('stack top:', peek());  // task-X
        api.switchStatus(null, { effect: 'pop' });  // pop and write resultData
    },

    init: (state, push) => { state.status = 'start'; },
});

ss.run();
console.log(ss.readState().resultData); // { popped: 'task-X' }
```

#### Example 2-7: `effect: 'run'` — Returning Control

```js
// Without child stacks, effect: 'run' triggers the runParent callback
const ss = createStateStack({
    state: {
        status: ['a', 'b'],                        // states: a → b → null
        resultData: {},                             // no result written
    },
    peek: (peek) => peek(),
    push: (push, data) => push(data),
    pop: (pop) => pop(),
    statusDispatcher: (peek, status) => status,

    a: (state, peek, api) => api.switchStatus('b'),
    b: (state, peek, api) => api.switchStatus(null, { effect: 'run' }),

    init: (state, push) => { state.status = 'a'; },
}, () => {
    console.log('control returned!');
});

ss.run();
// control returned!
```

---

## State Handler Deep Dive

Each state handler receives three parameters: `(state, peek, api)`.

### Example 3-1: Handler Three-Parameter Demo

```js
const ss = createStateStack({
    state: {
        status: ['demo'],                            // states: demo → null
        resultData: { processed: null },              // final { processed: top }
        extra: { timestamp: 0 },                     // final { timestamp: number }
    },
    peek: (peek) => peek(),
    push: (push, data) => push(data),
    pop: (pop) => pop(),
    statusDispatcher: (peek, status) => status,

    demo: (state, peek, api) => {
        // ① state — current state snapshot (read-only)
        console.log(state.status);
        console.log(state.resultData);

        // ② peek — for reading stack top data
        const top = peek();
        console.log('top:', top);

        // ③ api — operations with restrictions
        api.writeResultData({ processed: String(top) });
        api.writeExtra({ timestamp: Date.now() });

        // switchStatus — end
        api.switchStatus(null, { effect: 'push', param: ['final-item'] });
    },

    init: (state, push) => { state.status = 'demo'; push('init-data'); },
});

ss.run();
```

### Example 3-2: State is Read-Only

Modifying `state` directly within a handler has no effect on the state machine's actual status. Use `api.switchStatus()` to change status, use `api.writeResultData()` / `api.writeExtra()` to modify data.

```js
const ss = createStateStack({
    state: {
        status: ['modifyTest'],                      // state: modifyTest
        resultData: { value: 'original' },            // final unchanged
    },
    peek: (peek) => peek(),
    push: (push, data) => push(data),
    pop: (pop) => pop(),
    statusDispatcher: (peek, status) => status,

    modifyTest: (state, peek, api) => {
        // These modifications do not take effect
        state.status = 'something-else';
        state.resultData.value = 'modified';
        console.log('state is:', state);  // only local variable changes

        api.switchStatus(null);  // use API for actual changes
    },

    init: (state) => { state.status = 'modifyTest'; },
});

ss.run();
console.log(ss.readState()); // { status: null, resultData: { value: 'original' } }
```

---

## Stack

### Stack State Flow

```
ss.push('A');
ss.push('B');

Handler:           Stack:
  peek() → 'B'      ['A', 'B']   ← stack top is B
  pop()             ['A']        ← pop B
  peek() → 'A'      ['A']        ← stack top is now A
```

### Example 3-3: Restoring the Run Loop After Pop

When `switchStatus(null, { effect: 'pop' })` pops a frame and the stack still has items, `statusDispatcher` re-reads the stack top — the next handler can use the new stack top data.

```js
const ss = createStateStack({
    state: {
        status: ['level1', 'level2', 'done'],       // states: level1 → level2 → done → null
        resultData: { results: [] },                 // final { results: [1, 2] }
    },
    peek: (peek) => peek(),
    push: (push, data) => push(data),
    pop: (pop) => pop(),
    statusDispatcher: (peek, status) => status,

    level1: (state, peek, api) => {
        console.log('level1, top:', peek());
        api.switchStatus('level2', { effect: 'push', param: ['task-2'] });
    },
    level2: (state, peek, api) => {
        console.log('level2, top:', peek());
        api.switchStatus('done', { effect: 'push', param: ['task-3'] });
    },
    done: (state, peek, api) => {
        console.log('done, top:', peek());
        api.writeResultData({ results: ['final'] });
        api.switchStatus(null, { effect: 'pop' });
    },

    init: (state, push) => { state.status = 'level1'; push('task-1'); },
});

ss.run();
// level1, top: task-1
// level2, top: task-2
// done, top: task-3
```

---

## writeExtra — Additional Data Channel

`writeResultData` is the "primary" data channel used throughout the state machine's lifecycle. `writeExtra` is an additional channel — suitable for auxiliary data that should not affect the primary data on the store path.

### Example 4-1: writeResultData and writeExtra Usage

```js
const ss = createStateStack({
    state: {
        status: ['collect', 'finish'],              // states: collect → finish → null
        resultData: { main: 'default' },             // primary data
        extra: { debug: null },                      // auxiliary data
    },
    peek: (peek) => peek(),
    push: (push, data) => push(data),
    pop: (pop) => pop(),
    statusDispatcher: (peek, status) => status,

    collect: (state, peek, api) => {
        api.writeResultData({ main: 'important' });
        api.writeExtra({ debug: 'timestamps...' });
        api.switchStatus('finish');
    },
    finish: (state, peek, api) => {
        api.switchStatus(null, { effect: 'run' });
    },

    init: (state) => { state.status = 'collect'; },
});

ss.run();
console.log(ss.readState());
// { status: null, resultData: { main: 'important' } }
```

> Note: `readState()` only returns `status` and `resultData`. `extra` is included in the internal state but not exposed via the public interface.

### Example 4-2: Restriction Rule — Each per Cycle at Most Once

Calling `switchStatus`, `writeResultData`, or `writeExtra` more than once per cycle throws.

```js
const ss = createStateStack({
    state: {
        status: ['bad'],                             // state: bad → error
        resultData: {},
    },
    peek: (peek) => peek(),
    push: (push, data) => push(data),
    pop: (pop) => pop(),
    statusDispatcher: (peek, status) => status,

    bad: (state, peek, api) => {
        api.switchStatus(null, { effect: 'run' });
        api.switchStatus(null, { effect: 'pop' }); // Error: switchStatus called twice!
    },

    init: (state) => { state.status = 'bad'; },
});

try {
    ss.run();
} catch (e) {
    console.error(e.message);
    // 函数 #2 在一轮状态周期中调用超过一次
}
```

---

## Child Stacks

Child stacks are independent StateStack instances created within a state machine. They are suitable for sub-tasks that have their own independent lifecycle — such as deploying to different environments, processing sub-orders, etc.

### Example 4-3: Basic Child Stack

```js
const ss = createStateStack({
    state: {
        status: ['main', 'processChild', 'finish'],  // state flow
        resultData: { childDone: false },             // final child status
    },
    peek: (peek) => peek(),
    push: (push, data) => push(data),
    pop: (pop) => pop(),
    statusDispatcher: (peek, status) => status,

    main: (state, peek, api) => {
        // Create child stack
        api.createChildStateStack({
            state: {
                status: ['init', 'done'],
                resultData: { result: 'child-result' },
            },
            peek: (peek) => peek(),
            push: (push, data) => push(data),
            pop: (pop, writeResultData) => {
                writeResultData({ result: 'child-result' });
                pop();
            },
            statusDispatcher: (peek, status) => status,

            init: (state, push) => { state.status = 'init'; },
            init$1: (state, peek, api) => {
                api.switchStatus('done', { effect: 'run' });
            },
            done: (state, peek, api) => {
                api.switchStatus(null, { effect: 'pop' });
            },
        }, 'myChild');

        api.switchStatus('processChild');
    },
    processChild: (state, peek, api) => {
        api.switchStatus('finish', { effect: 'run', param: ['child', 'myChild'] });
    },
    finish: (state, peek, api) => {
        const childState = api.childStateStack('myChild').readState();
        api.writeResultData({ childDone: true });
        api.childStateStack('myChild').destroy();
        api.switchStatus(null, { effect: 'run' });
    },

    init: (state) => { state.status = 'main'; },
}, () => {
    console.log('finished, child state:', ss.readState());
});
```

### Example 4-4: Multi-Level Nested Stacks (Tree Structure)

```js
const ss = createStateStack({
    state: {
        status: ['root'],
        resultData: { a: null, b: null },
    },
    peek: (peek) => peek(),
    push: (push, data) => push(data),
    pop: (pop) => pop(),
    statusDispatcher: (peek, status) => status,

    root: (state, peek, api) => {
        // Create two child stacks
        api.createChildStateStack({
            state: { status: ['work'], resultData: { from: 'A' } },
            peek: (peek) => peek(),
            push: (push, data) => push(data),
            pop: (pop) => pop(),
            statusDispatcher: (peek, status) => status,
            work: (state, peek, api) => {
                api.switchStatus(null, { effect: 'pop' });
            },
            init: (state) => { state.status = 'work'; },
        }, 'stackA');

        api.createChildStateStack({
            state: { status: ['work'], resultData: { from: 'B' } },
            peek: (peek) => peek(),
            push: (push, data) => push(data),
            pop: (pop) => pop(),
            statusDispatcher: (peek, status) => status,
            work: (state, peek, api) => {
                api.switchStatus(null, { effect: 'pop' });
            },
            init: (state) => { state.status = 'work'; },
        }, 'stackB');

        // Execute child stacks sequentially
        api.switchStatus('runA', { effect: 'run', param: ['child', 'stackA'] });
    },
    runA: (state, peek, api) => {
        const resultA = api.childStateStack('stackA').readState();
        api.writeResultData({ a: resultA });
        api.switchStatus('runB', { effect: 'run', param: ['child', 'stackB'] });
    },
    runB: (state, peek, api) => {
        const resultB = api.childStateStack('stackB').readState();
        api.writeResultData({ b: resultB });
        api.childStateStack('stackA').destroy();
        api.childStateStack('stackB').destroy();
        api.switchStatus(null, { effect: 'run' });
    },

    init: (state) => { state.status = 'root'; },
});

ss.run();
// stackA: { from: 'A' }
// stackB: { from: 'B' }
```

---

## Module Chain (Refinement) — AOP-Style Function Overwriting

The module chain adds cross-cutting behavior (such as logging, caching, permission checking) to the state stack, transparently to the end user.

Core mechanism:

```
refineCreateStateStack({ pop: (prevPop) => () => { /* cross-cutting logic */; prevPop(); } })
```

- `refineCreateStateStack(refinementObject)` — identity function, purely a visual marker
- `createStateStack(refinementObject)` — returns a curried `createStateStack`, not an instance
- Supports overwriting: `pop`, `push`, `peek`, `switchStatus`, `writeResultData`, `writeExtra`

### Example 5-1: Single Module Overwrite (Inject Logging)

```js
// moduleA.js — overwrite pop, inject logging
import { refineCreateStateStack, createStateStack as _core } from 'state-stack';

export const createStateStack = _core(refineCreateStateStack({
    pop: (prevPop) => () => {
        console.log('[moduleA] pop before');
        prevPop();
        console.log('[moduleA] pop after');
    },
}));

// main.js — end user, unaware of the module chain
import { createStateStack } from './moduleA.js';

const ss = createStateStack({
    state: {
        status: ['start'],                         // states: start → null
        resultData: { done: true },                // final { done: true }
    },
    peek: (peek) => peek(),
    push: (push, data) => push(data),
    pop: (pop, writeResultData) => {
        writeResultData({ done: true });
        pop();
    },
    statusDispatcher: (peek, status) => status,

    start: (state, peek, api) => {
        api.switchStatus(null, { effect: 'pop' });
    },

    init: (state) => { state.status = 'start'; },
});

ss.run();
// [moduleA] pop before
// [moduleA] pop after
```

### Example 5-2: Multi-Module Chain

```js
// moduleA.js — overwrite pop
import { refineCreateStateStack, createStateStack as _core } from 'state-stack';
export const createStateStack = _core(refineCreateStateStack({
    pop: (prevPop) => () => {
        console.log('[pop] intercepted');
        prevPop();
    },
}));

// moduleB.js — extend from moduleA, overwrite push
import { createStateStack as _core } from './moduleA.js';
import { refineCreateStateStack } from 'state-stack';
export const createStateStack = _core(refineCreateStateStack({
    push: (prevPush) => (data) => {
        console.log('[push] intercepted:', data);
        prevPush(data);
    },
}));

// main.js — end user, only sees moduleB
import { createStateStack } from './moduleB.js';

const ss = createStateStack({
    state: {
        status: ['start', 'end'],                  // states: start → end → null
        resultData: { done: true },                // final { done: true }
    },
    peek: (peek) => peek(),
    push: (push, data) => push(data),
    pop: (pop, writeResultData) => {
        writeResultData({ done: true });
        pop();
    },
    statusDispatcher: (peek, status) => status,

    start: (state, peek, api) => {
        api.switchStatus('end', { effect: 'push', param: ['hello'] });
    },
    end: (state, peek, api) => {
        api.switchStatus(null, { effect: 'pop' });
    },

    init: (state) => { state.status = 'start'; },
});

ss.run();
// [push] intercepted: hello
// [pop] intercepted
```

Multi-module chained syntax for continuous layering:

```js
import { refineCreateStateStack, createStateStack as core } from 'state-stack';

const createStateStack = core(refineCreateStateStack({ pop: logPop }))
                           (refineCreateStateStack({ push: logPush }))
                           (refineCreateStateStack({ peek: logPeek }));
// Composed from left to right, layer by layer
```

---

## Instance Methods

The instance returned by `createStateStack(...)` exposes the following methods:

### `ss.run()`

Start/run the state machine. `init` has already executed at instance creation; `run()` starts with `statusDispatcher` and loops through `statusDispatcher → handler → effect` until status is `null`.

### `ss.readState()`

Returns the current state snapshot: `{ status, resultData }`. The internal state also contains `extra`, but it is not exposed in the returned structure.

```js
const state = ss.readState();
console.log(state.status);      // current status
console.log(state.resultData);  // result data
```

### `ss.push(data)`

Push data directly onto the stack (external push, bypassing the state machine).

```js
const ss = createStateStack({
    state: {
        status: ['main'],                          // state: main → null
        resultData: {},                             // no result written
    },
    peek: (peek) => peek(),
    push: (push, data) => { console.log('received:', data); push(data); },
    pop: (pop) => pop(),
    statusDispatcher: (peek, status) => status,

    main: (state, peek, api) => {
        api.switchStatus(null, { effect: 'pop' });
    },
    init: (state) => { state.status = 'main'; },
});

ss.push('external data');  // external push
ss.run();
// received: external data
```

### `ss.destroy()`

Destroy the instance. Idempotent — the second call does not throw. After destruction, all methods (`run`, `readState`, `push`) throw errors.

```js
ss.destroy();
ss.destroy();      // ✅ idempotent, no error

ss.run();          // ❌ Error: StateStack has been destroyed
ss.readState();    // ❌ Error: StateStack has been destroyed
ss.push('x');      // ❌ Error: StateStack has been destroyed
```

---

## Real-World Scenarios

### Example 6-1: E-Commerce Order Processing Pipeline

A complete order lifecycle from creation to completion. Each stage pushes an operation record onto the stack, and the final result aggregates the order's lifecycle trace.

```
State flow: pending → paid → shipped → completed
Stack:     [order snapshot, payment record, shipping record]
resultData: final accumulated order info
```

```js
import { createStateStack } from 'state-stack';

const ss = createStateStack({
    state: {
        status: ['pending', 'paid', 'shipped', 'completed'],  // order statuses
        resultData: { orderId: 0, paymentId: '', trackingNo: '' },
    },
    peek: (peek) => peek(),
    push: (push, data) => {
        console.log('[push]', data);
        push(data);
    },
    pop: (pop, writeResultData) => {
        const record = pop();
        writeResultData(record);              // write the popped record to resultData
        console.log('[pop]', record);
    },
    statusDispatcher: (peek, status) => status,

    // ① Order created → pending payment
    pending: (state, peek, api) => {
        api.switchStatus('paid', {
            effect: 'push',
            param: [{ event: 'created', time: Date.now() }],
        });
    },

    // ② Payment complete → pending shipment
    paid: (state, peek, api) => {
        api.writeResultData({ paymentId: 'pay_12345' });
        api.switchStatus('shipped', {
            effect: 'push',
            param: [{ event: 'paid', amount: 99.9, time: Date.now() }],
        });
    },

    // ③ Shipped → pending confirmation
    shipped: (state, peek, api) => {
        api.writeResultData({ trackingNo: 'SF_998877' });
        api.switchStatus('completed', {
            effect: 'push',
            param: [{ event: 'shipped', carrier: 'SF', time: Date.now() }],
        });
    },

    // ④ Completed → pop and finish
    completed: (state, peek, api) => {
        api.switchStatus(null, { effect: 'pop' });
    },

    init: (state) => { state.status = 'pending'; },
});

ss.run();

// Read final result
const final = ss.readState();
console.log('final resultData:', final.resultData);
// Sample output:
//   [push] { event: 'created', time: 1715000000000 }
//   [push] { event: 'paid', amount: 99.9, time: 1715000001000 }
//   [push] { event: 'shipped', carrier: 'SF', time: 1715000002000 }
//   [pop] { event: 'shipped', carrier: 'SF', time: 1715000002000 }
//   final resultData: { trackingNo: 'SF_998877', paymentId: 'pay_12345' }
```

> In the example above, `writeResultData` is called during `paid` and `shipped` to accumulate information,
> but the final `pop`'s `writeResultData` overwrites the final value.
> If you want to preserve the full per-stage record, write stage data to `extra` and only store the final state in `resultData`.

---

### Example 6-2: CI/CD Build and Multi-Environment Deployment System

An automated build-and-deploy pipeline. The main stack handles build + test, and child stacks handle deployment to different environments. It also demonstrates module chain notification injection.

```
Main stack states: queued → building → testing → deploying → verifying
Child stacks:    staging deploy → smoke test
                 production deploy → health check
```

```js
import { createStateStack, refineCreateStateStack } from 'state-stack';

// ── Child stack factory (one per environment) ──
function createEnvironmentDeployer(envName) {
    return {
        state: {
            status: ['deploying', 'healthCheck', 'done'],
            resultData: { env: envName, status: '' },
        },
        peek: (peek) => peek(),
        push: (push, data) => push(data),
        pop: (pop) => pop(),
        statusDispatcher: (peek, status) => status,

        deploying: (state, peek, api) => {
            console.log(`[${envName}] deploying...`);
            api.switchStatus('healthCheck');
        },
        healthCheck: (state, peek, api) => {
            const passed = Math.random() > 0.2; // 80% pass rate
            api.writeResultData({ status: passed ? 'healthy' : 'unhealthy' });
            console.log(`[${envName}] health check:`, passed ? '✅' : '❌');
            api.switchStatus(null, { effect: 'run' });  // return to main stack
        },

        init: (state) => { state.status = 'deploying'; },
    };
}

// ── Main pipeline state machine ──
const ss = createStateStack({
    state: {
        status: ['queued', 'building', 'testing', 'deploying', 'verifying'],
        resultData: { buildId: '', testReport: '', deployResults: {} },
    },
    peek: (peek) => peek(),
    push: (push, data) => push(data),
    pop: (pop) => pop(),
    statusDispatcher: (peek, status) => status,

    queued: (state, peek, api) => {
        console.log('[CI] build queued');
        api.writeResultData({ buildId: 'build_' + Date.now() });
        api.switchStatus('building');
    },
    building: (state, peek, api) => {
        console.log('[CI] building...');
        api.switchStatus('testing', { effect: 'push', param: ['v1.0.0'] });
    },
    testing: (state, peek, api) => {
        // Simulate test
        const passed = Math.random() > 0.3;
        api.writeResultData({
            testReport: { passed: passed, failures: passed ? 0 : 2 },
        });
        console.log('[CI] tests:', passed ? 'PASSED' : 'FAILED');
        // Decide whether to deploy based on test results
        if (!passed) {
            api.switchStatus(null, { effect: 'run' });  // test failed, stop pipeline
        } else {
            api.switchStatus('deploying');
        }
    },
    deploying: (state, peek, api) => {
        // Create two environment child stacks
        api.createChildStateStack(createEnvironmentDeployer('staging'), 'staging');
        api.createChildStateStack(createEnvironmentDeployer('production'), 'production');

        // Deploy staging first
        api.switchStatus('runStaging', { effect: 'run', param: ['child', 'staging'] });
    },
    runStaging: (state, peek, api) => {
        api.switchStatus('runProduction', { effect: 'run', param: ['child', 'production'] });
    },
    runProduction: (state, peek, api) => {
        // Collect deployment results from both environments
        const stagingResult = api.childStateStack('staging').readState();
        const prodResult = api.childStateStack('production').readState();
        api.writeResultData({
            deployResults: { staging: stagingResult, production: prodResult },
        });
        api.childStateStack('staging').destroy();
        api.childStateStack('production').destroy();
        api.switchStatus(null, { effect: 'run' });
    },

    init: (state) => { state.status = 'queued'; },
}, () => {
    console.log('[CI] pipeline finished, result:',
        JSON.stringify(ss.readState().resultData, null, 2));
});

// ── Inject audit logging with module chain ──
const createStateStackWithLogging = createStateStack(refineCreateStateStack({
    push: (prevPush) => (data) => {
        console.log('[audit] push:', data);
        prevPush(data);
    },
    pop: (prevPop) => () => {
        console.log('[audit] pop');
        prevPop();
    },
}));

// Use the logging version to create another pipeline instance
// const ss2 = createStateStackWithLogging({ ... });

console.log('=== CI/CD Pipeline Start ===');
ss.run();
```

> This example demonstrates three core patterns:
> 1. **Child stack collaboration**: each environment deployment is an independent child stack
> 2. **resultData accumulation**: build ID → test report → deployment results
> 3. **Module chain**: `refineCreateStateStack` injects audit logging

---

## Common Errors

| Error Scenario | Error Message |
|----------------|---------------|
| Restricted function called too many times | `函数 #n 在一轮状态周期中调用超过一次` |
| Calling a method on a destroyed instance | `StateStack has been destroyed` |
| Invalid `createStateStack` argument | `参数必须是 StateStackDefinitionObject（含 state 字段）或 StateStackRefinementObject（不含 state 字段）` |
| Child stack ID not found | `childStateStack id "xxx" not found` |

> See [API Reference](./api-reference.md) for the complete list of errors.
