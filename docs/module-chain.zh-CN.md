# 模块链（Refinement）— 函数覆写系统

> 本文档详解 StateStack 的模块链机制。完整的运行示例见[使用指南](./usage-guide.zh-CN.md#模块链refinementaop-式函数覆写)。

---

## 为什么叫 refine？

`refineCreateStateStack` 中的 **`refine` 取 re-define（重新定义）之意**，不是"精炼/提纯"。

它的含义是：**保存当前层某个函数的实现，在其周围包裹新逻辑，从而重新定义它的行为**——就像给一个函数套上一层新的"外皮"。

```
原有 pop 函数
  ┌──────────────────────┐
  │ 做一些事            │
  │ originalPop()        │     ← 模块链包裹后
  │ 做一些事            │
  └──────────────────────┘
           ↓
  ┌──────────────────────┐
  │ 日志: "pop before"  │     ← 模块 A 注入的横切逻辑
  │  ┌────────────────┐ │
  │  │ originalPop()  │ │     ← 原始逻辑不变
  │  └────────────────┘ │
  │ 日志: "pop after"   │     ← 模块 A 注入的横切逻辑
  └──────────────────────┘
```

> 如果你熟悉 Express/Koa 的中间件或 Python 的装饰器，这个模式本质上是一样的——只是套在函数级别而非请求级别。

---

## 机制

### 核心：overwriteChain

模块链的实现基于一个简单的 `reduce`：

```js
// funcTransformer.js — 核心逻辑
export function transformer(originalFunc, overwriteChain) {
    if (!overwriteChain || overwriteChain.length === 0) {
        return originalFunc;
    }
    return overwriteChain.reduce((prevFunc, fn) => fn(prevFunc), originalFunc);
}
```

`overwriteChain` 是一个数组，每个元素是 `(prevFunc) => newFunc` 类型的函数。`reduce` 将它们从左到右逐层复合。

### 存储：closureService

`closureService.js` 维护了 6 个函数的覆写链，各自独立：

```js
const chains = {
    pop: [],
    push: [],
    peek: [],
    switchStatus: [],
    writeResultData: [],
    writeExtra: [],
};
```

调用 `closure.push(refinementObject)` 时，每个非空字段被追加到对应的 chain 中。

### 触发条件

`createStateStack` 有两种模式，由参数是否含有 `state` 字段区分：

| 模式 | 参数特征 | 行为 |
|------|----------|------|
| **定义模式** | 含 `state` 字段 | 直接创建实例 |
| **模块链模式** | 不含 `state` 字段 | 将参数存入 closure，返回新的柯里化 `createStateStack` |

```js
// 定义模式
createStateStack({ state: { ... }, ... })           → StateStackInstance

// 模块链模式
createStateStack({ pop: (prev) => ... })             → CurriedCreateStateStack
createStateStack({ pop: (prev) => ... })({ state: ... }) → StateStackInstance
```

---

## 用法

### 单模块

在一个模块中覆写一个函数：

```js
// moduleA.js
import { refineCreateStateStack, createStateStack as _core } from '@ffort_233/state-stack';

export const createStateStack = _core(refineCreateStateStack({
    pop: (prevPop) => () => {
        // 在原有 pop 之前/之后做额外的事
        console.log('[moduleA] pop before');
        prevPop();                           // 调用原来的 pop
        console.log('[moduleA] pop after');
    },
}));
```

最终使用者（main.js）导入 `moduleA.js` 的 `createStateStack`，完全不知道模块链的存在。

### 多模块叠加

多个模块可以链式叠加，每个模块只覆写自己关心的函数：

```
moduleA 覆写 pop
  → moduleB 覆写 push（基于 moduleA 导出的 createStateStack）
    → 最终使用者导入 moduleB
```

覆写的复合顺序与模块链的添加顺序一致，从左到右。

### 链式语法

多个覆写可以在一个表达式中连续叠加：

```js
import { refineCreateStateStack, createStateStack as core } from '@ffort_233/state-stack';

const createStateStack = core(refineCreateStateStack({ pop: logPop }))
                           (refineCreateStateStack({ push: logPush }))
                           (refineCreateStateStack({ peek: logPeek }));
```

相当于先应用 `logPop`，再应用 `logPush`，最后应用 `logPeek`。

### `refineCreateStateStack` 是什么？

它只是一个**恒等函数**（identity function），输入什么就返回什么。它的作用是提供**视觉标识**：

- 让读者一眼看出这是在"重新定义"某个函数
- 在 TypeScript 中提供类型推断支持
- 不加它效果一样，但加了语义更清晰

```js
// 不加 refineCreateStateStack 也能工作，但可读性差
createStateStack({ pop: (prev) => () => { /* ... */ prev(); } });

// 加 refineCreateStateStack，意图一目了然
createStateStack(refineCreateStateStack({ pop: (prev) => () => { /* ... */ prev(); } }));
```

---

## 可覆写的函数

| 函数 | 签名 | 说明 |
|------|------|------|
| `pop` | `(prevPop) => () => unknown` | 弹栈操作，返回弹出的值 |
| `push` | `(prevPush) => (data) => void` | 入栈操作 |
| `peek` | `(prevPeek) => () => unknown` | 读取栈顶 |
| `switchStatus` | `(prevSwitchStatus) => (...args: unknown[]) => void` | 状态切换 |
| `writeResultData` | `(prevWriteResultData) => (value) => void` | 写入结果数据 |
| `writeExtra` | `(prevWriteExtra) => (value) => void` | 写入附加数据 |

---

## 适用场景

### 日志 / 审计

在每次 push/pop 时记录操作轨迹，对业务代码完全透明。

### 缓存

覆写 `peek` 或 `push`，在栈操作前后检查缓存：

```js
createStateStack(refineCreateStateStack({
    push: (prevPush) => (data) => {
        if (cache.has(data)) return;  // 缓存命中，不压栈
        prevPush(data);
    },
}));
```

### 权限检查

在 `switchStatus` 前校验当前用户是否有权进入目标状态。

### 埋点 / 监控

在 `pop` 时记录耗时、在 `switchStatus` 时上报状态变更事件。

---

## 与定义对象的关系

模块链覆写的函数和定义对象中同名的函数**不是同一层**的。它们的执行顺序是：

```
用户定义对象中的函数（highest level）
    ↓ 调用 simpleXxx
模块链覆写的函数（middleware layer）
    ↓ transformer.reduce
原始栈函数（simplest level）
```

以 `pop` 为例：

```
定义对象中的 pop:
  (simplePop, writeResultData) => { 写入结果; simplePop(); }

模块链中的 pop:
  (prevPop) => () => { 日志; prevPop(); 日志; }

执行顺序：
  定义 pop → simplePop（即：模块链复合 → 原始栈 pop）
```

---

## 延伸阅读

- [使用指南 - 模块链](./usage-guide.zh-CN.md#模块链refinementaop-式函数覆写) — 完整运行示例
- [核心概念](./core-concepts.zh-CN.md) — peek、statusDispatcher、受限函数
