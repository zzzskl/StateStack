# API 参考

> 本文档是 StateStack 的完整 API 查询手册。教程和示例见[使用指南](./usage-guide.zh-CN.md)。

---

## `createStateStack(param, runParent?)`

### 定义模式 — 创建实例

参数含 `state` 字段时，直接创建一个状态机实例。

```
createStateStack(definition: StateStackDefinition<S>, runParent?: () => void): StateStackInstance
```

**`definition` 字段表：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `state` | `{ status: string[], resultData: object, extra?: object }` | ✓ | 状态类型声明（不参与初始化，仅作文档约定） |
| `peek` | `(simplePeek: () => unknown) => unknown` | | 自定义 peek 逻辑，包装基础 peek |
| `push` | `(simplePush: (data: unknown) => void, data: unknown) => void` | | 自定义 push 逻辑 |
| `pop` | `(simplePop: () => unknown, simpleWriteResultData: (value: unknown) => void) => void` | | 自定义 pop 逻辑，可在此写入最终结果 |
| `statusDispatcher` | `(peek: () => unknown, status: S \| null) => S \| null` | ✓ | 返回当前要执行的状态名；返回 `null` 终止状态机 |
| `init` | `(state: StateSnapshot, push: (data: unknown) => void) => void` | | 初始化函数，`createStateStack()` 调用时立即执行 |
| `[statusName]` | `(state: StateSnapshot, peek: () => unknown, api: StateAPI<S>) => void` | | 状态处理函数，以字段名作为状态名称 |

> `S` 是 `state.status` 数组中所有字符串的联合类型。`S` 中的每个状态名必须有对应的 handler。

**参数说明：**

- `simplePeek` / `simplePush` / `simplePop` — 经过模块链增强后的基础栈操作，调用它们来触发实际栈行为
- `simpleWriteResultData` — 基础结果写入函数，直接覆盖 `state.resultData`
- 额外的参数（如 `data`）由 `switchStatus` 的 `effect.param` 或外部 `ss.push()` 传递

**`runParent` 回调：**

当 handler 调用的 `switchStatus` 携带 `{ effect: 'run' }` 且没有指定子栈时，控制权回传给 `runParent` 并终止当前循环。

```js
const ss = createStateStack({ /* ... */ }, () => {
    console.log('控制权回到调用者');
});
```

---

### 模块链模式 — 返回柯里化函数

参数不含 `state` 字段时，进入模块链模式。

```
createStateStack(refinement: StateStackRefinementObject, runParent?): CurriedCreateStateStack
```

返回的 `CurriedCreateStateStack` 可以继续传入 `refinementObject`（继续叠加）或 `StateStackDefinition`（终止链，创建实例）。

```js
const curried = createStateStack({ pop: (prev) => () => { /* ... */ prev(); } });
const instance = curried({ state: { status: [], resultData: {} }, /* ... */ });
```

---

## `refineCreateStateStack(refinementObject)`

恒等函数（identity function），输入即输出。仅作为**视觉标识**，不改变行为。

```typescript
function refineCreateStateStack(refinementObject: StateStackRefinementObject): StateStackRefinementObject
```

作用：
- 帮助读者识别"这是一次函数覆写"
- 在 TypeScript 中提供类型推断

---

## `StateStackRefinementObject`

模块链模式中用于覆写函数的对象。每个字段是 `(prevFunc) => newFunc` 形式的包装函数。

```typescript
interface StateStackRefinementObject {
    pop?:            (prevPop: () => unknown)               => () => unknown;
    push?:           (prevPush: (data: unknown) => void)    => (data: unknown) => void;
    peek?:           (prevPeek: () => unknown)              => () => unknown;
    switchStatus?:   (prevSwitchStatus: (...args: unknown[]) => void) => (...args: unknown[]) => void;
    writeResultData?:(prevWriteResultData: (value: unknown) => void) => (value: unknown) => void;
    writeExtra?:    (prevWriteExtra: (value: unknown) => void)   => (value: unknown) => void;
}
```

---

## `StateStackInstance` — 实例方法

`createStateStack(...)` 返回的实例。

```typescript
interface StateStackInstance {
    run(): void;
    readState(): StateSnapshot;
    push(data: unknown): void;
    destroy(): void;
}
```

| 方法 | 说明 |
|------|------|
| `run()` | 启动/运行状态机。`init` 在实例创建时已执行；`run()` 从 `statusDispatcher` 开始，循环执行 `statusDispatcher → handler → effect` 直到状态为 `null` 或 `{effect:'run'}` 触发控制权转移 |
| `readState()` | 返回当前状态快照 `{ status, resultData }` |
| `push(data)` | 外部入栈，不经过状态机。数据由下一轮 handler 的 `peek()` 读取 |
| `destroy()` | 销毁实例。幂等——重复调用不抛错。销毁后所有方法抛 `Error: StateStack has been destroyed` |

---

## `StateSnapshot`

```typescript
interface StateSnapshot {
    status: string | null;
    resultData: Record<string, unknown>;
}
```

注意：`readState()` 返回的公开快照只包含 `status` 和 `resultData`。内部状态还包含 `extra`，但不在此接口中暴露。

---

## `StateAPI<S>` — handler 第三个参数

状态处理函数的 `api` 参数包含以下方法。泛型 `S` 是声明过的状态名联合类型。

```typescript
interface StateAPI<S extends string> {
    writeResultData(value: unknown): void;
    writeExtra(value: unknown): void;
    switchStatus(nextStatus: S | null, effect?: EffectDescriptor): void;
    createChildStateStack(def: Record<string, unknown>, id: string): void;
    childStateStack(id: string): ChildStateStackHandle;
}
```

| 方法 | 限制 | 说明 |
|------|------|------|
| `switchStatus(nextStatus, effect?)` | **每轮 ≤1** | 切换状态 + 携带 effect 描述。`{effect:'run'}` 触发控制权转移并终止循环 |
| `writeResultData(value)` | **每轮 ≤1** | 覆盖写入 `state.resultData` |
| `writeExtra(value)` | **每轮 ≤1** | 覆盖写入 `state.extra` |
| `createChildStateStack(def, id)` | 无 | 创建子栈，`id` 用于后续引用 |
| `childStateStack(id)` | 无 | 获取子栈句柄 |

### 受限规则

`switchStatus`、`writeResultData`、`writeExtra` 各自在一轮 run 循环中最多调用一次。超出抛错：

```
Error: 函数 #2 在一轮状态周期中调用超过一次
```

> `#n` 对应 `initTimer` 中传入的函数顺序：0 = writeExtra, 1 = writeResultData, 2 = switchStatus。

### 子栈句柄

```typescript
interface ChildStateStackHandle {
    readState(): StateSnapshot;
    push(data: unknown): void;
    destroy(): void;
}
```

- `readState()` — 读取子栈当前状态快照
- `push(data)` — 向子栈推入数据
- `destroy()` — 销毁子栈实例（幂等）

---

## `EffectDescriptor`

`switchStatus` 的第二个参数，携带栈操作描述。

```typescript
interface EffectDescriptor {
    effect?: 'pop' | 'push' | 'run';
    param?: unknown;
}
```

| 形式 | 效果 |
|------|------|
| 无 `effect` | 纯状态切换，无栈操作 |
| `{ effect: 'push', param: [a, b, c] }` | 将 `a, b, c` 作为独立参数传入 push 函数（自动解包） |
| `{ effect: 'pop' }` | 弹出栈顶。弹栈时会用 `simpleWriteResultData` 写入 `pop` 定义中的结果 |
| `{ effect: 'run' }` | 控制权回传给 `runParent` 回调并终止当前循环 |
| `{ effect: 'run', param: ['child', id] }` | 运行指定子栈，子栈结束后回到当前栈继续 |

注意：
- `param` 为 `push` 提供入栈数据，格式为 `[arg1, arg2, ...]`（数组包裹，自动解包为独立参数）
- `param` 为 `run` 提供子栈标识，格式为 `['child', id]`（两个元素的数组）

---

## 类型定义导入

项目附带完整 TypeScript 类型声明（`index.d.ts`）。

```typescript
import { createStateStack, refineCreateStateStack } from 'state-stack';
import type {
    StateStackInstance,
    StateStackDefinition,
    StateStackRefinementObject,
    StateAPI,
    StateHandler,
    EffectDescriptor,
    ChildStateStackHandle,
    StateSnapshot,
    CurriedCreateStateStack,
} from 'state-stack';
```

---

## 错误情况

| 错误场景 | 错误消息 |
|----------|----------|
| 受限函数超限调用 | `函数 #n 在一轮状态周期中调用超过一次` |
| 调用已销毁实例的方法 | `StateStack has been destroyed` |
| `createStateStack` 参数非法（非对象/null/数字等） | `createStateStack: 参数必须是 StateStackDefinition（含 state 字段）或 StateStackRefinementObject（不含 state 字段）` |
| 子栈 ID 不存在 | `childStateStack id "xxx" not found` |

---

## 延伸阅读

- [使用指南](./usage-guide.zh-CN.md) — 完整示例和教程
- [核心概念](./core-concepts.zh-CN.md) — peek、statusDispatcher、受限函数的设计哲学
- [模块链](./module-chain.zh-CN.md) — 函数覆写系统详解
