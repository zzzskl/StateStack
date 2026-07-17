# 核心概念

> 本文档深入解释 StateStack 的四个核心概念，帮助你理解"为什么这样设计"而非仅仅"怎么用"。
> 完整的示例请见[使用指南](./usage-guide.md)。

---

## 1. `peek` — 栈与状态机的桥梁

### 它解决了什么问题？

在普通状态机中，当前状态决定了做什么。但在 StateStack 中，**栈顶的内容**同样应该参与决策——因为栈代表了"当前正在处理的工作单元"。

考虑一个递归解析的场景：每一层委派是一个栈帧。当状态机处理某一层时，它需要读取**当前层的栈顶**（即当前正在处理的工作单元）来决定下一步。这就是 `peek` 的职责。

### peek 出现的位置

```
┌──────────────────────────────────────────────────────┐
│  definition 对象                                       │
│                                                       │
│  ┌─ statusDispatcher(peek, status) → statusName ────┐ │
│  │   ① 在决定状态时可以感知栈顶                      │ │
│  └──────────────────────────────────────────────────┘ │
│                                                       │
│  ┌─ statusHandler(state, peek, api) ───────────────┐ │
│  │   ② 在处理状态时可以读取栈顶数据                  │ │
│  └──────────────────────────────────────────────────┘ │
│                                                       │
│  ┌─ peek: (simplePeek) => value ───────────────────┐ │
│  │   ③ 用户可以自定义 peek 逻辑（如缓存、转换）      │ │
│  └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

### 数据流

```
run 循环
  │
  ├─ statusDispatcher(peek, status)   ← 调用 peek() 获取栈顶
  │     ↓
  ├─ 返回 statusName
  │     ↓
  ├─ handler(state, peek, api)       ← handler 内再次调用 peek()
  │     ↓
  └─ api.switchStatus(nextStatus, effect)
```

### 关键理解

- `peek` 和 `status` 是两个独立的信息源：前者来自栈，后者来自状态机
- `statusDispatcher` 同时拿到两者，可以做出比纯状态机更丰富的路由决策
- handler 中的 `peek` 主要用于读取当前工作单元的数据，而非改变状态

---

## 2. `statusDispatcher` — 职责边界：只判断，不执行

### 它做什么

`statusDispatcher(peek, status)` 的职责只有一个：**返回当前应该执行哪个状态 handler 的名称**。它不操作栈、不修改状态、不产生副作用。

```
statusDispatcher 的输入：
  - peek()   → 栈顶元素（当前工作单元）
  - status   → 当前状态名（字符串或 null）

statusDispatcher 的输出：
  - statusName (string)  → 执行对应的 handler
  - null                → 结束状态机
```

### 典型模式

| 模式 | 实现 | 适用场景 |
|------|------|----------|
| 简单流转 | `(peek, status) => status` | 线性流水线 |
| peek 驱动 | 检查 `peek()` 的值决定下一状态 | 根据工作单元类型路由 |

### 不做的事

- ❌ 不调用 `push` / `pop`
- ❌ 不修改 `status`
- ❌ 不产生副作用
- ❌ 不执行业务逻辑

这个限制是刻意设计的：`statusDispatcher` 只做**路由决策**，执行交给 handler。这样做使得路由逻辑可测试、可追踪。

---

## 3. 受限函数 — "一轮循环的影响是确定的"

### 设计哲学

`switchStatus`、`writeResultData`、`writeExtra` 各自在**一轮 run 循环中最多调用一次**。超出则抛错。

这不是防呆机制，而是核心设计原则：

> **一轮状态循环能承载多少逻辑、产生多少影响，应该是确定的。**

### 为什么？

没有这个限制，会出现：

```
// 有问题的模式（不受限时可能发生）
dangerous: (state, peek, api) => {
    api.switchStatus('a');
    api.writeResultData({ x: 1 });
    api.switchStatus('b');        // 覆盖了上一条 switchStatus
    api.writeResultData({ y: 2 }); // 覆盖了上一条 writeResultData
    api.switchStatus('c');
    // 最终效果是什么？只有最后一条有效，前面三条是垃圾操作
}
```

有了限制：

- 每个 handler 在一轮中只能做**一件确定的事**：切到一个状态、写一次结果、写一次附加数据
- 调用者可以确定一个 handler 的可观测影响上限
- 组合多个 handler 时不用担心"某一步悄悄做了多余的事"

### 机制

```
run 循环开始 → checkTimes() 记录快照
       ↓
handler 执行 → switchStatus / writeResultData / writeExtra 每次调用计数 +1
       ↓
run 循环结束 → checkTimes() 取新快照，比对增量
       ↓
增量 > 1 → 抛错
增量 = 0 或 1 → 正常
```

### 不受限的操作

`createChildStateStack` 和 `childStateStack` 不受限制，因为它们不改变当前栈的状态。

---

## 4. Effect 三种操作的语义

### 为什么只有三种？

StateStack 的洞察是：大多数"逐层深入"的工作流，其控制流操作可以归结为三种原语：

| 操作 | 栈的变化 | 工作流含义 | 
|------|----------|------------|
| **push** | 栈顶压入新元素 | 进入子任务，当前状态挂起 |
| **pop** | 栈顶弹出 | 子任务完成，回到上一层 |
| **run** | 栈不变 | 控制权转移，执行另一个栈 |

这三种操作覆盖了递归解析、多阶段流水线、嵌套事务等场景中的所有状态转移模式。

### push — 进入更深层级

```
栈状态：         handler 执行：
[item1]         api.switchStatus('next', { effect: 'push', param: [item2] })
[item1, item2]  ← item2 入栈，下一轮 handler 可以看到 item2
```

push 意味着"当前工作没完，先压个新任务进来"。

### pop — 返回上层

```
栈状态：         handler 执行：
[item1, item2]  api.switchStatus(null, { effect: 'pop' })
[item1]         ← item2 弹出，回到 item1
```

pop 意味着"当前工作完成了，带着结果回上一层"。

### run — 控制权转移

```
当前栈执行 handler：
  api.switchStatus('done', { effect: 'run' })
    → 控制权回到 runParent 回调
    → 或者执行子栈（{ effect: 'run', param: ['child', id] }）
```

run 意味着"当前工作告一段落，把控制权交给外部"。

### 组合使用

这三个操作可以组合：push 后 pop、push 再 run、pop 后再 push……覆盖了嵌套工作流的所有控制流模式。

---

## 延伸阅读

- [使用指南](./usage-guide.md) — 完整的示例和教程
- [模块链（Refinement）](./module-chain.md) — AOP 式函数覆写
- [API 参考](./api-reference.md) — 接口签名和类型定义
