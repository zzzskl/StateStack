# 使用指南

> 本文档包含 StateStack 的完整使用示例和详细说明。如果你是第一次接触，建议先阅读 [README](../README.md) 的快速开始。

---

## 安装

```bash
npm install state-stack
```

```js
import { createStateStack, refineCreateStateStack } from 'state-stack';
```

---

## 快速开始

### 例 1-1：最小状态机（入门）

下面是一个三状态（`idle → processing → done`）的最小状态机。它展示了完整的栈操作流程：**入栈 → 处理 → 弹栈 → 结束**。

```js
import { createStateStack } from 'state-stack';

const ss = createStateStack({
    // ── 状态类型声明 ──
    state: {
        status: ['idle', 'processing', 'done'],  // 所有可能的 status 值
        resultData: { done: false },              // resultData 字段结构
    },

    // ── 栈操作定义 ──
    peek: (peek) => peek(),                       // 读取栈顶
    push: (push, data) => push(data),             // 入栈
    pop: (pop, writeResultData) => {              // 弹栈 + 写入结果
        writeResultData({ done: true });
        pop();
    },

    // ── 状态分发：决定当前执行哪个状态 handler ──
    statusDispatcher: (peek, status) => status,

    // ── 状态处理函数 ──
    idle: (state, peek, api) => {
        api.switchStatus('processing', { effect: 'push', param: ['task-001'] });
    },
    processing: (state, peek, api) => {
        api.switchStatus('done', { effect: 'pop' });
    },
    done: (state, peek, api) => {
        api.switchStatus(null, { effect: 'run' }); // null 状态 = 结束
    },

    // ── 初始化（createStateStack() 调用时立即执行） ──
    init: (state, push) => { state.status = 'idle'; },
});

ss.run();
console.log(ss.readState()); // { status: null, resultData: { done: true } }
```

**执行流程：**
```
init → status = 'idle'
  → idle handler: switchStatus('processing', push) → 栈压入 'task-001'
  → processing handler: switchStatus('done', pop) → 弹栈
  → done handler: switchStatus(null, run) → 结束
```

### 例 1-2：带 runParent 回传控制权

`effect: 'run'` 能将控制权回传给调用者。`createStateStack` 的第二个参数 `runParent` 就是接收这个回传的回调。

```js
import { createStateStack } from 'state-stack';

const ss = createStateStack({
    state: {
        status: ['start', 'end'],                  // 状态：start → end → null
        resultData: { result: 'ok' },              // 最终 { result: 'ok' }
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
        api.switchStatus(null, { effect: 'run' }); // 回传控制权
    },

    init: (state, push) => { state.status = 'start'; },
}, () => {
    // runParent — 当栈内 effect: 'run' 触发时，控制权回到这里
    console.log('[runParent] control returned to creator');
});

console.log('=== run ===');
ss.run();
console.log('=== done ===');
// 输出:
//   [start]
//   [end]
//   [runParent] control returned to creator
//   === done ===
```

---

## 状态格式约定

StateStack 中 `state` 字段是一个 **类型文档约定**，它**不参与初始化**，纯粹用于告诉阅读者这个状态机有哪些状态和字段。

```js
state: {
    status: ['idle', 'processing', 'done'],   // ← 列出所有可能的 status 值
    resultData: { done: false },               // ← 展示 resultData 的字段结构
}
```

| 字段 | 声明格式 | 运行时实际类型 | 说明 |
|------|----------|---------------|------|
| `status` | `string[]`（枚举所有状态值） | `string \| null` | `null` = 状态机结束 |
| `resultData` | `object`（展示字段结构） | `object` | 由 `writeResultData()` 覆盖写入 |
| `extra`（可选） | `object`（展示字段结构） | `object` | 由 `writeExtra()` 覆盖写入 |

**运行时数据流示例：**

```
init → state = { status: 'idle',     resultData: {} }
  → idle handler → switchStatus('processing', { effect: 'push' })
  → state = { status: 'processing', resultData: {} }
  → processing handler → writeResultData({ done: true }) → switchStatus(null, { effect: 'pop' })
  → state = { status: null,          resultData: { done: true } }   ← 结束
```

> `state` 的声明格式来源于设计草稿 v1 — `status: []` 表示「可接受的状态值集合」，`resultData: {}` 表示「结果数据的字段容器」。
> 这类似于 TypeScript 的类型标注：声明时描述形状，运行时由逻辑填充。

---

## 核心概念

### 1. `peek` — 读取栈顶

`peek` 是栈操作和状态机之间的桥梁。它在三个地方出现：
- **定义对象中的 `peek` 字段**：自定义读取逻辑
- **`statusDispatcher` 的第一参数**：在决定状态时可以感知栈顶
- **状态 handler 的第二参数**：在处理状态时可以读取栈顶

#### 例 2-1：peek 读取栈顶数据

```js
const ss = createStateStack({
    state: {
        status: ['start', 'process'],              // 状态：start → process → null
        resultData: {},                             // 无结果写入
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
        const top = peek();               // 读取当前栈顶
        console.log('processing:', top);  // processing: my-data
        api.switchStatus(null, { effect: 'pop' });
    },

    init: (state, push) => { state.status = 'start'; },
});

ss.run();
```

#### 例 2-2：peek 与 statusDispatcher 配合决定状态

`statusDispatcher` 的第一个参数就是 `peek`。你可以根据栈顶元素来动态决定进入哪个状态。

```js
const ss = createStateStack({
    state: {
        status: ['start', 'decide', 'fastTrack'],  // 状态流转
        resultData: {},                             // 无结果写入
    },
    peek: (peek) => peek(),
    push: (push, data) => push(data),
    pop: (pop) => pop(),
    // 根据栈顶元素的值来决定状态
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

### 2. `statusDispatcher` — 状态分发

`statusDispatcher(peek, status)` 每次循环被调用，需要返回当前状态名称。参数 `status` 是当前状态名（字符串或 `null`）。返回值会作为 key 去 `definition` 中查找对应的 handler。

#### 例 2-3：基于 `status` 简单分发

最常见的用法 — 由 `switchStatus` 直接写入状态，`statusDispatcher` 读取当前状态名并返回。

```js
const ss = createStateStack({
    state: {
        status: ['step1', 'step2'],                // 状态：step1 → step2 → null
        resultData: {},                             // 无结果写入
    },
    peek: (peek) => peek(),
    push: (push, data) => push(data),
    pop: (pop) => pop(),
    statusDispatcher: (peek, status) => status,  // 直接返回状态名

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

#### 例 2-4：基于 `peek()` 自定义分发

你可以基于栈顶内容做出复杂的分发逻辑，而不只是依赖当前状态名 `status`。

```js
const ss = createStateStack({
    state: {
        status: ['empty', 'processString', 'processNumber'],  // 状态流转
        resultData: {},                                        // 无结果写入
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

### 3. `api.switchStatus()` + Effect — 驱动栈操作

`switchStatus(nextStatus, effect?)` 是状态机的心脏：
- **`nextStatus`**：下一轮的状态名（`null` 表示结束）
- **`effect`**：携带一个栈操作描述

| Effect | 含义 |
|--------|------|
| 无 `effect` | 纯状态切换，无栈操作 |
| `{ effect: 'push', param: [data] }` | 将 `data` 入栈 |
| `{ effect: 'pop' }` | 弹出栈顶 |
| `{ effect: 'run' }` | 控制权回传（触发 `runParent`） |
| `{ effect: 'run', param: ['child', id] }` | 运行指定子栈 |

#### 例 2-5：`effect: 'push'` — 入栈

```js
const ss = createStateStack({
    state: {
        status: ['collect', 'summarize'],          // 状态：collect → summarize → null
        resultData: {},                             // 无结果写入
    },
    peek: (peek) => peek(),
    push: (push, data) => { console.log('push:', data); push(data); },
    pop: (pop) => pop(),
    statusDispatcher: (peek, status) => status,

    collect: (state, peek, api) => {
        // 批量入栈
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

#### 例 2-6：`effect: 'pop'` — 弹栈

```js
const ss = createStateStack({
    state: {
        status: ['start', 'process'],              // 状态：start → process → null
        resultData: { popped: 'task-X' },          // 最终 { popped: 'task-X' }
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
        api.switchStatus(null, { effect: 'pop' });  // 弹栈并写入 resultData
    },

    init: (state, push) => { state.status = 'start'; },
});

ss.run();
console.log(ss.readState().resultData); // { popped: 'task-X' }
```

#### 例 2-7：`effect: 'run'` — 控制权回传

```js
// 无子栈时，effect: 'run' 触发 runParent 回调
const ss = createStateStack({
    state: {
        status: ['a', 'b'],                        // 状态：a → b → null
        resultData: {},                             // 无结果写入
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

## 状态处理函数详解

每个状态 handler 接收三个参数：`(state, peek, api)`。

### 例 3-1：handler 三参数完整演示

```js
const ss = createStateStack({
    state: {
        status: ['demo'],                            // 状态：demo → null
        resultData: { processed: null },              // 最终 { processed: top }
        extra: { timestamp: 0 },                     // 最终 { timestamp: number }
    },
    peek: (peek) => peek(),
    push: (push, data) => push(data),
    pop: (pop) => pop(),
    statusDispatcher: (peek, status) => status,

    demo: (state, peek, api) => {
        // ① state — 当前状态快照（只读）
        console.log(state.status);
        console.log(state.resultData);

        // ② peek — 读取栈顶
        const top = peek();

        // ③ api — 操作方法集
        api.writeResultData({ processed: top });    // 受限，每轮 ≤1
        api.writeExtra({ timestamp: Date.now() });  // 受限，每轮 ≤1
        api.switchStatus(null, { effect: 'pop' });  // 受限，每轮 ≤1
    },

    init: (state, push) => { state.status = 'demo'; },
});

ss.run();
```

### API 方法速览

| 方法 | 限制 | 说明 |
|------|------|------|
| `api.switchStatus(nextStatus, effect?)` | **每轮 ≤1** | 切换状态 + 触发栈操作 |
| `api.writeResultData(value)` | **每轮 ≤1** | 写入结果数据到 `state.resultData` |
| `api.writeExtra(value)` | **每轮 ≤1** | 写入附加数据到 `state.extra` |
| `api.createChildStateStack(def, id)` | 无限制 | 创建子栈 |
| `api.childStateStack(id)` | 无限制 | 获取子栈句柄 |

---

## 受限函数

`switchStatus`、`writeResultData`、`writeExtra` 每轮状态循环中最多调用一次。这是设计核心——**一轮循环的影响是确定的**。

### 例 3-2：受限函数正常使用

```js
const ss = createStateStack({
    state: {
        status: ['safe'],                              // 状态：safe → null
        resultData: { x: 1 },                          // 最终 { x: 1 }
        extra: { y: 2 },                               // 最终 { y: 2 }
    },
    peek: (peek) => peek(),
    push: (push, data) => push(data),
    pop: (pop) => pop(),
    statusDispatcher: (peek, status) => status,

    safe: (state, peek, api) => {
        api.writeResultData({ x: 1 });    // ?? 第一次调用
        api.writeExtra({ y: 2 });          // ?? 第一次调用
        api.switchStatus(null, { effect: 'run' }); // ?? 第一次调用
    },

    init: (state, push) => { state.status = 'safe'; },
});

ss.run(); // OK
```

### 例 3-3：超限调用抛错

```js
const ss = createStateStack({
    state: {
        status: ['dangerous'],                     // 状态：dangerous → 抛错
        resultData: {},                             // 未写入
    },
    peek: (peek) => peek(),
    push: (push, data) => push(data),
    pop: (pop) => pop(),
    statusDispatcher: (peek, status) => status,

    dangerous: (state, peek, api) => {
        api.switchStatus('a');    // 第一次 ??
        api.switchStatus('b');    // ?? 抛错！同一轮中第二次调用
    },

    init: (state, push) => { state.status = 'dangerous'; },
});

try {
    ss.run();
} catch (e) {
    console.log(e.message); // "函数 #2 在一轮状态周期中调用超过一次"
}
```

```js
// 另一个超限示例：writeResultData 重复调用
const ss2 = createStateStack({
    state: {
        status: ['bad'],                              // 状态：bad → 抛错
        resultData: {},                               // 未写入
    },
    peek: (peek) => peek(),
    push: (push, data) => push(data),
    pop: (pop) => pop(),
    statusDispatcher: (peek, status) => status,

    bad: (state, peek, api) => {
        api.writeResultData({ a: 1 });  // ??
        api.writeResultData({ b: 2 });  // ?? 抛错
    },

    init: (state, push) => { state.status = 'bad'; },
});

try { ss2.run(); } catch (e) {
    console.log(e.message); // "函数 #1 在一轮状态周期中调用超过一次"
}
```

---

## 子栈（Child Stack）

子栈是独立的 StateStack 实例，由父栈在 handler 中通过 `api.createChildStateStack(def, id)` 创建。子栈运行完后通过 `{ effect: 'run', param: ['child', id] }` 将控制权交回父栈。

### 例 4-1：单子栈 — 创建 → 运行 → 读取 → 销毁

```js
const ss = createStateStack({
    state: {
        status: ['createChild', 'runChild', 'readChild', 'done'],  // 父栈状态
        resultData: {},                                             // 子栈运行后读取结果
    },
    peek: (peek) => peek(),
    push: (push, data) => push(data),
    pop: (pop) => pop(),
    statusDispatcher: (peek, status) => status,

    // ① 创建子栈
    createChild: (state, peek, api) => {
        api.createChildStateStack({
            state: {
                status: ['waiting', 'processing'],       // 子栈状态
                resultData: { childResult: 'ok' },       // 最终 { childResult: 'ok' }
            },
            peek: (peek) => peek(),
            push: (push, data) => { console.log('[child] push:', data); push(data); },
            pop: (pop, writeResultData) => {
                writeResultData({ handled: true });
                pop();
            },
            statusDispatcher: (peek, status) => status,

            waiting: (state, peek, api) => {
                api.switchStatus('processing');
            },
            processing: (state, peek, api) => {
                api.writeResultData({ childResult: 'ok' });
                api.switchStatus(null, { effect: 'run' });
            },
            init: (state) => { state.status = 'waiting'; },
        }, 'child1');

        api.switchStatus('runChild');
    },

    // ② 切换到子栈执行
    runChild: (state, peek, api) => {
        api.switchStatus('readChild', { effect: 'run', param: ['child', 'child1'] });
    },

    // ③ 读取子栈结果并销毁
    readChild: (state, peek, api) => {
        const childState = api.childStateStack('child1').readState();
        console.log('[parent] child state:', childState);
        // { status: null, resultData: { childResult: 'ok' } }

        api.childStateStack('child1').destroy();
        api.switchStatus('done');
    },

    done: (state, peek, api) => {
        api.switchStatus(null, { effect: 'run' });
    },

    init: (state) => { state.status = 'createChild'; },
});

ss.run();
// [child] push: data
// [parent] child state: { status: null, resultData: { childResult: 'ok' } }
```

### 例 4-2：两个子栈交替使用

```js
const ss = createStateStack({
    state: {
        status: ['createChildren', 'runA', 'runB', 'readAll'],  // 父栈状态
        resultData: {},                                          // 子栈结果统一在 readAll 中读取
    },
    peek: (peek) => peek(),
    push: (push, data) => push(data),
    pop: (pop) => pop(),
    statusDispatcher: (peek, status) => status,

    createChildren: (state, peek, api) => {
        // 创建两个子栈
        api.createChildStateStack(makeChildDef('A'), 'stackA');
        api.createChildStateStack(makeChildDef('B'), 'stackB');
        api.switchStatus('runA');
    },

    runA: (state, peek, api) => {
        api.switchStatus('runB', { effect: 'run', param: ['child', 'stackA'] });
    },
    runB: (state, peek, api) => {
        api.switchStatus('readAll', { effect: 'run', param: ['child', 'stackB'] });
    },
    readAll: (state, peek, api) => {
        const a = api.childStateStack('stackA').readState();
        const b = api.childStateStack('stackB').readState();
        console.log('stackA:', a.resultData);
        console.log('stackB:', b.resultData);
        api.childStateStack('stackA').destroy();
        api.childStateStack('stackB').destroy();
        api.switchStatus(null, { effect: 'run' });
    },

    init: (state) => { state.status = 'createChildren'; },
});

function makeChildDef(label) {
    return {
        state: {
            status: ['work'],                          // 子栈状态：work → null
            resultData: { from: label },               // 最终 { from: 'A' } 或 { from: 'B' }
        },
        peek: (peek) => peek(),
        push: (push, data) => push(data),
        pop: (pop, writeResultData) => { writeResultData({ from: label }); pop(); },
        statusDispatcher: (peek, status) => status,
        work: (state, peek, api) => {
            api.switchStatus(null, { effect: 'pop' });
        },
        init: (state) => { state.status = 'work'; },
    };
}

ss.run();
// stackA: { from: 'A' }
// stackB: { from: 'B' }
```

---

## 模块链（Refinement）— AOP 式函数覆写

模块链用于为状态栈添加横切行为（如日志、缓存、权限检查），对最终使用者透明。

核心机制：

```
refineCreateStateStack({ pop: (prevPop) => () => { /* 横切逻辑 */; prevPop(); } })
```

- `refineCreateStateStack(refinementObject)` — 恒等函数，纯视觉标识
- `createStateStack(refinementObject)` — 返回柯里化的新 `createStateStack`，而非实例
- 支持覆写：`pop`、`push`、`peek`、`switchStatus`、`writeResultData`、`writeExtra`

### 例 5-1：单模块覆写（注入日志）

```js
// moduleA.js — 覆写 pop，注入日志
import { refineCreateStateStack, createStateStack as _core } from 'state-stack';

export const createStateStack = _core(refineCreateStateStack({
    pop: (prevPop) => () => {
        console.log('[moduleA] pop before');
        prevPop();
        console.log('[moduleA] pop after');
    },
}));

// main.js — 最终使用者，不知道模块链的存在
import { createStateStack } from './moduleA.js';

const ss = createStateStack({
    state: {
        status: ['start'],                         // 状态：start → null
        resultData: { done: true },                // 最终 { done: true }
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

### 例 5-2：多模块链式叠加

```js
// moduleA.js — 覆写 pop
import { refineCreateStateStack, createStateStack as _core } from 'state-stack';
export const createStateStack = _core(refineCreateStateStack({
    pop: (prevPop) => () => {
        console.log('[pop] intercepted');
        prevPop();
    },
}));

// moduleB.js — 从 moduleA 继续覆写 push
import { createStateStack as _core } from './moduleA.js';
import { refineCreateStateStack } from 'state-stack';
export const createStateStack = _core(refineCreateStateStack({
    push: (prevPush) => (data) => {
        console.log('[push] intercepted:', data);
        prevPush(data);
    },
}));

// main.js — 最终使用者，只看到 moduleB
import { createStateStack } from './moduleB.js';

const ss = createStateStack({
    state: {
        status: ['start', 'end'],                  // 状态：start → end → null
        resultData: { done: true },                // 最终 { done: true }
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

多模块链式语法可以连续叠加：

```js
import { refineCreateStateStack, createStateStack as core } from 'state-stack';

const createStateStack = core(refineCreateStateStack({ pop: logPop }))
                           (refineCreateStateStack({ push: logPush }))
                           (refineCreateStateStack({ peek: logPeek }));
// 从左到右逐层复合
```

---

## 实例方法

`createStateStack(...)` 返回的实例暴露以下方法：

### `ss.run()`

启动/运行状态机。`init` 在实例创建时已执行；`run()` 从 `statusDispatcher` 开始，循环执行 `statusDispatcher → handler → effect` 直到状态为 `null`。

### `ss.readState()`

返回当前状态快照：`{ status, resultData }`。内部状态还包含 `extra`，但不在返回结构中暴露。

```js
const state = ss.readState();
console.log(state.status);      // 当前状态
console.log(state.resultData);  // 结果数据
```

### `ss.push(data)`

直接向栈中推入数据（外部推入，不经过状态机）。

```js
const ss = createStateStack({
    state: {
        status: ['main'],                          // 状态：main → null
        resultData: {},                             // 无结果写入
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

ss.push('external data');  // 外部入栈
ss.run();
// received: external data
```

### `ss.destroy()`

销毁实例。幂等操作——第二次调用不抛错。销毁后所有方法（`run`、`readState`、`push`）均抛错。

```js
ss.destroy();
ss.destroy();      // ?? 幂等，不抛错

ss.run();          // ?? Error: StateStack has been destroyed
ss.readState();    // ?? Error: StateStack has been destroyed
ss.push('x');      // ?? Error: StateStack has been destroyed
```

---

## 真实场景

### 例 6-1：电商订单处理流水线

一个完整的电商订单从创建到完成的流转过程。每个阶段都把操作记录入栈，最后统一输出订单生命周期轨迹。

```
状态流转：pending → paid → shipped → completed
栈内容：  [订单快照, 支付记录, 发货记录]
resultData：最终累积的订单信息
```

```js
import { createStateStack } from 'state-stack';

const ss = createStateStack({
    state: {
        status: ['pending', 'paid', 'shipped', 'completed'],  // 订单状态
        resultData: { orderId: 0, paymentId: '', trackingNo: '' },
    },
    peek: (peek) => peek(),
    push: (push, data) => {
        console.log('[push]', data);
        push(data);
    },
    pop: (pop, writeResultData) => {
        const record = pop();
        writeResultData(record);              // 将弹出的记录写入 resultData
        console.log('[pop]', record);
    },
    statusDispatcher: (peek, status) => status,

    // ① 订单创建 → 待支付
    pending: (state, peek, api) => {
        api.switchStatus('paid', {
            effect: 'push',
            param: [{ event: 'created', time: Date.now() }],
        });
    },

    // ② 支付完成 → 待发货
    paid: (state, peek, api) => {
        api.writeResultData({ paymentId: 'pay_12345' });
        api.switchStatus('shipped', {
            effect: 'push',
            param: [{ event: 'paid', amount: 99.9, time: Date.now() }],
        });
    },

    // ③ 发货完成 → 待确认
    shipped: (state, peek, api) => {
        api.writeResultData({ trackingNo: 'SF_998877' });
        api.switchStatus('completed', {
            effect: 'push',
            param: [{ event: 'shipped', carrier: 'SF', time: Date.now() }],
        });
    },

    // ④ 完成 → 弹栈并结束
    completed: (state, peek, api) => {
        api.switchStatus(null, { effect: 'pop' });
    },

    init: (state) => { state.status = 'pending'; },
});

ss.run();

// 读取最终结果
const final = ss.readState();
console.log('final resultData:', final.resultData);
// 输出示例:
//   [push] { event: 'created', time: 1715000000000 }
//   [push] { event: 'paid', amount: 99.9, time: 1715000001000 }
//   [push] { event: 'shipped', carrier: 'SF', time: 1715000002000 }
//   [pop] { event: 'shipped', carrier: 'SF', time: 1715000002000 }
//   final resultData: { trackingNo: 'SF_998877', paymentId: 'pay_12345' }
```

> 上例中 `writeResultData` 在 `paid` 和 `shipped` 阶段被调用累积信息，
> 最后 `pop` 的 `writeResultData` 覆盖了最终值。
> 如果想保留完整的阶段记录，可以把阶段性数据写入 `extra`，而 `resultData` 仅存放最终状态。

---

### 例 6-2：CI/CD 构建与多环境部署系统

一个自动化构建部署流水线。主栈负责构建 + 测试，子栈负责不同环境的部署。同时演示模块链注入通知逻辑。

```
主栈状态：queued → building → testing → deploying → verifying
子栈：    staging 部署 → 冒烟测试
          production 部署 → 健康检查
```

```js
import { createStateStack, refineCreateStateStack } from 'state-stack';

// ── 定义子栈生成函数（每个环境一个子栈） ──
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
            const passed = Math.random() > 0.2; // 80% 通过
            api.writeResultData({ status: passed ? 'healthy' : 'unhealthy' });
            console.log(`[${envName}] health check:`, passed ? '??' : '??');
            api.switchStatus(null, { effect: 'run' });  // 回到主栈
        },

        init: (state) => { state.status = 'deploying'; },
    };
}

// ── 主流水线状态机 ──
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
        // 模拟测试
        const passed = Math.random() > 0.3;
        api.writeResultData({
            testReport: { passed: passed, failures: passed ? 0 : 2 },
        });
        console.log('[CI] tests:', passed ? 'PASSED' : 'FAILED');
        // 根据测试结果决定是否继续部署
        if (!passed) {
            api.switchStatus(null, { effect: 'run' });  // 测试失败，终止流水线
        } else {
            api.switchStatus('deploying');
        }
    },
    deploying: (state, peek, api) => {
        // 创建两个环境子栈
        api.createChildStateStack(createEnvironmentDeployer('staging'), 'staging');
        api.createChildStateStack(createEnvironmentDeployer('production'), 'production');

        // 先部署 staging
        api.switchStatus('runStaging', { effect: 'run', param: ['child', 'staging'] });
    },
    runStaging: (state, peek, api) => {
        api.switchStatus('runProduction', { effect: 'run', param: ['child', 'production'] });
    },
    runProduction: (state, peek, api) => {
        // 收集两个环境的部署结果
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

// ── 用模块链注入审计日志 ──
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

// 使用带日志的版本创建另一个流水线实例
// const ss2 = createStateStackWithLogging({ ... });

console.log('=== CI/CD Pipeline Start ===');
ss.run();
```

> 这个例子展示了三个核心模式：
> 1. **子栈协作**：每个环境部署为一个独立子栈
> 2. **resultData 累积**：构建 ID → 测试报告 → 部署结果
> 3. **模块链**：`refineCreateStateStack` 注入审计日志

---

## 常见错误

| 错误场景 | 错误消息 |
|----------|----------|
| 受限函数超限调用 | `函数 #n 在一轮状态周期中调用超过一次` |
| 调用已销毁实例的方法 | `StateStack has been destroyed` |
| `createStateStack` 参数非法 | `参数必须是 StateStackDefinitionObject（含 state 字段）或 StateStackRefinementObject（不含 state 字段）` |
| 子栈 ID 不存在 | `childStateStack id "xxx" not found` |

> 完整错误列表见 [API 参考](./api-reference.md)。
