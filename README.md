# StateStack

**来自作者**：stateStack 是一个将栈和状态机融合在一起的东西。它的设计有几个关键点。

一是没有用类，整个库实现使用对象表达，但是仍然能够支持多个模块导入导出的静态加强，以一点模块副作用为代价。以及与类相似的声明式体验。

二是支持嵌套，一个 stateStack 可以创建拥有其子 stateStack，并使用显式的 run 在各级 stateStack 和根实例创建者之间进行控制流转移。

三是限制状态机在一轮信息收集-做出行动循环中所能造成的效果，通过让 effect 以固定的形式，栈操作 pop/push 和控制流 run 转移来表达。同时限制 write 写操作，switchStatus 的调用次数。

四是让栈顶元素参与到 statusDispatcher 中影响状态分支，提供了更强的拓展性。

目前项目可能还会缺少一些细节和边界上的优化和处理。欢迎在issue中提出。希望我的项目能够成为你在问题场景中合适的建模工具。

补充：目前项目中的run循环检查到status为null时会返回，这并不符合设计本意。避免使用这种方式返回，而是使用run调用根创造者传入的函数来显式转移控制流。

[![npm version](https://img.shields.io/npm/v/state-stack)](https://www.npmjs.com/package/state-stack)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/types-included-blue)](./index.d.ts)

---

## 什么是 StateStack？

StateStack 不是一个普通的状态机库。它适合这样的场景：

> **你的工作流是"逐层深入、逐层返回"的嵌套结构**——比如递归解析、多阶段流水线、嵌套事务。每层做一件事，做完带着结果回上一层。StateStack 把这种"分层推进、逐层返回"的模式固化为三个原语操作：**push（入栈）**、**pop（弹栈）**、**run（控制权转移）**。

**什么时候用它？**

- 你的流程有"进入子任务 → 子任务完成 → 回到父任务"的天然栈结构
- 你想让每层业务逻辑独立编写，不需要手写状态转移表
- 你想把副作用（入栈、弹栈、调子流程）收束到固定的操作形式，方便做横切（日志、缓存、审计）

**什么时候不必要？**

- 只有 2-3 个状态的简单标志位 — 一个 `switch/case` 就够了
- 复杂的并发状态、正交区域状态 — XState 等工具更合适

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

下面是一个三状态（`idle → processing → done`）的最小状态机，展示完整的**入栈 → 处理 → 弹栈 → 结束**流程。

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

---

## 文档

| 文档 | 内容 |
|------|------|
| **[使用指南](./docs/usage-guide.md)** | 完整的使用示例：peek、statusDispatcher、effect、受限函数、子栈、模块链、真实场景 |
| **[核心概念](./docs/core-concepts.md)** | peek 的本质、statusDispatcher 职责、受限函数设计哲学、effect 语义 |
| **[模块链（Refinement）](./docs/module-chain.md)** | AOP 式函数覆写：为什么叫 refine、单模块/多模块/链式语法、适用场景 |
| **[API 参考](./docs/api-reference.md)** | 完整接口签名、类型定义、限制规则、错误情况 |

---

## 源码结构

```
src/
├── Stack.js                  # 原始栈 + 状态原型（simplest 层）
├── funcTransformer.js        # overwriteChain 函数复合（reduce）
├── closureService.js         # 模块链存储
├── funcTimer.js              # 受限函数计数器包装
├── createStateStack.js       # 入口：模块链 / 实例创建双模式
└── createStateStackCore.js   # 核心工厂：四层作用域 + 运行循环
```

---

## 协议

[Apache 2.0](./LICENSE)
