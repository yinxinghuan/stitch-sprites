# 《拆线精灵》技术文档

## 1. 技术栈

- TypeScript + Vite 6，原生 DOM/CSS，不依赖 UI 框架。
- Canvas 2D 绘制绣绷、源纹理遮罩、精灵、路径、拆线和回收动画。
- Web Audio API 程序化合成音效。
- Pillow + NumPy 离线处理素材页、逻辑针点、调色板、透明纹理、线轴方案和审核图。
- Playwright 做 390×844、320×568 视觉/流程/性能自动化；TypeScript 独立状态回放验证全部关卡。
- `vite.config.ts` 使用 `base: './'`，构建产物为可部署到任意子路径的 `dist/`。

## 2. 目录结构

```text
src/
  main.ts                         启动、视图/引擎/渲染器装配
  game-id.ts                      Remix 可替换 UUID 与同源 Worker API base
  styles.css                     响应式布局、材质、卡牌与结算样式
  i18n.ts                        zh/en 文案
  game/
    engine.ts                    权威状态、选牌、批次工作、完成/失败/存档
    progress.ts                  稳定节点存档 schema、本地仓库、合并与绣艺分
    levels.ts                    组装正式 41 关，并保存隔离的双入口／六色圆环实验关
    generated-patterns.ts        生成的网格、逐关调色板、四列线轴与解法
    reachability.ts              外部洪泛、可达颜色、目标与步行路径
    renderer.ts                  Canvas 静态缓存、源纹理遮罩、精灵与线束动画
    palette.ts                   七种玩法色、符号及逐关色板解析
    audio.ts                     Web Audio 事件音效
    types.ts                     关卡、棋盘、线轴、快照与任务类型
  ui/
    view.ts                      HUD、五槽、四列牌、绣品册、结算
    icons.ts                     统一 SVG 功能图标
  platform/
    contracts.ts                 可剥离的存档/排行榜端口
    create-platform-services.ts  本地优先存档与可选 Aigram 适配器装配
    aigram-bridge.ts             Aigram Web/iOS 双通道请求与资料页桥接
public/
  patterns/<key>.png             41 张透明高清十字绣纹理
  alteru-storage-scope.js        自托管 session 隔离存储适配器
scripts/
  generate-stitch-patterns.py    裁图、原生针点、无飞地、纹理和关卡数据生成
doc/references/
  chapter-*-candidates-*.png     六色／七色候选素材页
  rejected/                      明确淘汰且不得接入的素材页
  level-square-audit/            每关独立 1:1 裁切审核图
  generated-pattern-order.md     当前颜色/复杂度排序证据
_qa/
  solve-levels.ts                41 关解法与代表性失败路径回放
  dual-entry-lab.ts              双入口、双可恢复路线与槽位差异门禁
  capture-dual-entry-lab.mjs     实验关双尺寸、压力态与结算截图
  multi-ring-lab.ts              18 圈安全路线与玩家选择卡死的完整网格回放
  multi-ring-strategy-sim.ts     三种人类近似策略的批量牌序压力统计
  capture-multi-ring-lab.mjs     六色圆环双尺寸初始态与失败态截图
  progress-migration.ts          旧关卡进度到 v4 精选关卡重排迁移回归
  feature-regression.mjs         首动风险、稳定存档、可选榜单与双击缩放回归
  capture-levels.mjs             全关截图、溢出和卡牌均衡检查
  capture.mjs                    首动、完成、失败、窄屏、外部访客流程
  capture-gallery.mjs            41 张图鉴、底部滚动稳定与解锁检查
  capture-walk.mjs               行走/拆线/持续推进时间序列
  perf.mjs                       CPU 限速输入与帧率采样
```

## 3. 核心模块

### 素材与关卡生成

`scripts/generate-stitch-patterns.py` 是素材到运行时数据的唯一流水线：

1. 从素材页的针脚密度谷推断分割边界。
2. 对单图找前景、闭合主体和原生网格相位；移除布纹噪声、相邻碎片和主体包络外飞地。
3. 按素材自身 4/5/7/8px 针距采样，不统一重采样分辨率。
4. 输出逻辑玩法色 `rows`、逐关源色 `palette` 和透明源纹理 `public/patterns/<key>.png`。
5. 只保留固定的 7 幅旧作品；新候选按玩法色数、暴露层与拓扑压力排序，生成 17 幅六色、17 幅七色正式关。
6. 用增量外部洪泛离线生成可拆顺序和线轴容量；跨层同色线轴允许先工作一部分、带剩余容量等待后续开路。四列首牌保持完整尺寸，后续最多六张牌由 `GameView` 渲染为紧密颜色预览带。
7. 生成器根据章节请求 0–4 个标准解等待线轴；高压检查点为第 24、37、38 关，并由 TypeScript 权威规则回放完整解和五次选择内的玩家失败路径。
8. 每次生成同步输出 41 张透明纹理、独立 1:1 审核图、全量联系表和裁切审计图；输入母版不安全或主体越过画幅即淘汰，不靠运行时缩小补救。

线轴方案必须离线生成。旧实现曾在页面启动时计算整套关卡，导致高密度数据初始化超过 30 秒；当前运行时只读取 41 关预生成结果。

### 状态与规则

`GameEngine` 持有当前关、逻辑格、四列线轴、五个活动槽、阶段和已拆数。`selectColumn()` 立即把顶部线轴送入槽位，然后 `processWork()` 循环：

- `findReachable()` 从棋盘外部穿过空格和已拆格洪泛。
- 每个工作线轴一次派 4–12 个精灵，并用共享路径图寻找真实步行路线。当前 1.0× 基线为 560–1180ms 去程、190ms 出队间隔和 170ms 逻辑释放延时；常量集中在 `engine.ts`，可供后续有上限的速度档位缩放。
- 任务抵达后才清除逻辑格、减少容量并批量发出状态更新。
- 容量归零移除线轴；无剩余格进入完成；五槽满且无任务进入失败。

第 1 关只在第一次输入强制正确列；第一次真实拆线后，所有关卡都允许错误颜色进入等待轴位。仅第 1 关首次五槽堵塞会展示 650ms 后自动退回最后一卷，第 2 关起进入真实失败。

`DUAL_ENTRY_LAB_LEVEL` 是不属于正式关卡生成流水线的机制探针。历史测试 URL `?lab=dual-entry&level=42` 仍作为兼容入口，`levels.ts` 只在内存中用实验定义替换最后一个运行时槽位，不改写 41 关生成数据。实验关不加载高清纹理，直接使用逻辑针点；显式关卡查询使引擎不读取/写入中途局，入口同时关闭远程合并、排行榜展示与提交。两个外露入口都可立即拆线并最终通关，但权威回放固定验证低压力路线峰值等待 0、高压力路线峰值等待 2，避免把假选择或死路误当成路线决策。

`MULTI_RING_LAB_LEVEL` 通过 `?lab=multi-ring&level=42` 使用同一隔离路径。当前实验关是 73×73、3969 针、18 个完整同心圈；六种颜色各出现三次并改变回返次序。四列首牌为蓝／红／绿／黄，保证蓝色最外圈有直接可执行的第一步。18 张牌的权威安全路线峰值占槽为 4，可完整清空；`[0,1,2,3,0,1,2,3,2,3,2]` 则在第 11 次选择后留下 1757 针和五个等待线轴，唯一可达色为红色。`_qa/multi-ring-strategy-sim.ts` 以 10,000 个固定种子比较均匀选择、只匹配当前首牌、查看一张背牌三种策略；统计模型只用于筛选牌序，最终仍由完整网格回放和真实界面确认可解与卡死。

`progress.ts` 以版本化 `PersistedProgress` 保存最高解锁关、逐关最佳绣艺分和当前稳定关卡状态。引擎只在关卡载入或整批任务结算后写入，保存已拆格索引、四列、五槽和本局决策统计；动画中途关闭会回到上一稳定节点。当前 schema 为 v4：旧版只迁移用户明确保留的旧 2/4/5/9/13/20/27 关到新 1–7 关，并按新编号修正基础分；旧中途局全部清空，淘汰关卡的成绩不进入新进度。`alteruLocalStorage` 负责同部署 UUID 的本地隔离；平台适配器存在时以 1 秒防抖同步相同 JSON 到 Aigram 云存档。云数据只在本次尚无玩家操作时接管当前局，本地与云端的解锁关和逐关最好分始终取并集/最大值。

绣艺分不使用时间：单关为 `1000 + levelId × 25 + 零错误奖励 250 + 无帮助奖励 250`，每关只保留最好一次，总分为逐关最好分之和。这样金币、广告和未来速度升级不会改变排行榜公平性。

### 渲染与性能

`BoardRenderer` 使用三层 Canvas。每次载入、重开或恢复都会提升 `runRevision`；即使仍是同一关，revision 改变也会清除旧精灵任务与静态清除缓存，强制重绘完整棋盘，避免“槽位清空但针脚仍保持拆除”的假重开。

- `baseCanvas`：木绷和织物，只在尺寸/关卡变化时重画。
- `staticCanvas`：源十字绣纹理按未清除格的 `Path2D` 遮罩绘制；清除时只从底层回填对应格。
- 可见 Canvas：每帧合成静态层，再绘制活动精灵、工具、线束和洞口反馈。

源纹理通过 `new URL('./patterns/<key>.png', document.baseURI)` 加载，兼容任意部署子路径。纹理未完成加载时使用逻辑针点后备绘制；成功后一次 `drawImage` 进入遮罩，不逐针重绘高清图。无动态任务时停止 RAF。进入完成/失败时清空残余任务，防止结算后角色堆积。

本轮视觉回放覆盖第 24 关与第 41 关、390×844 和 320×568；放大后的精灵没有越出绣绷或破坏队列。390×844、2× DPR、6× CPU 限速下，第 24／41 关首个可见响应为 23.6／27.1ms，平均帧间隔 9.19／9.25ms，p95 为 15／10.3ms；两关各出现 1 帧 >50ms 的冷启动峰值，其余持续动画没有形成卡顿串。

### UI、输入、音频与 i18n

`GameView` 渲染紧凑 HUD、五槽、四列牌、绣品册、结果层和可选榜单。绣品册打开时按已解锁最高关缓存其 DOM，不因引擎动画帧重复重建而改变 `scrollTop`；未解锁卡片只渲染编号与锁，不创建图案 Canvas。游戏牌用 `pointerdown`；可滚动绣品册和榜单使用 `click`。根游戏区域用 `touch-action: manipulation` 并阻止默认 `dblclick`，保留两次游戏输入但不触发页面放大；滚动层恢复 `pan-y pinch-zoom`。所有可见文案经过 `t()`，支持 zh/en。音频在首次手势后解锁，失败时静默降级，不参与权威状态更新。

游戏没有自有玩法后台、头像或微信权限依赖。核心引擎只接收 `ProgressRepository`，不导入 Aigram；`PlatformServices` 在入口组合本地仓库与可选平台能力。没有有效宿主身份时 `leaderboard` 为 `null`，榜首入口和榜单完全不渲染；移除 `src/platform/` 并改为 `LocalProgressRepository` 后仍可完整运行。Aigram 环境按当前游戏 UUID 提交总绣艺分、展示榜首/完整榜单/自己标记，并只向本次刚超过的最高分用户发送 `score_beat`。Pages 仍是同 commit 的静态前端镜像，默认退化为本地存档且无榜单。

## 4. 扩展点

- **新增/替换图案**：把素材页放入 `doc/references/`，更新生成脚本 `SOURCES`，运行生成器；不要手改 `generated-patterns.ts` 或 `public/patterns/`。
- **调整难度排序与每关选择数**：修改生成脚本的章节顺序键、`target_selections()`、`requested_carry_reels()` 或列分配规则，重新生成并跑全关解法、失败检查点和 v4 存档迁移。
- **调整双入口实验**：只修改 `levels.ts` 的 `DUAL_ENTRY_LAB_LEVEL` 与 `_qa/dual-entry-lab.ts` 的两条权威路线；正式 `GENERATED_PATTERNS` 与玩家进度不得随实验变化。
- **调整六色圆环实验**：只修改 `levels.ts` 的 `MULTI_RING_LAB_LEVEL`、`_qa/multi-ring-lab.ts` 与策略模拟；必须同时复验蓝色首牌、18 张牌安全解、玩家选择卡死、三类策略差异及双尺寸失败／结算画面。
- **修改可达/失败规则**：编辑 `reachability.ts` 与 `engine.ts`，同步更新生成器中的离线洪泛合同。
- **调整颜色和符号**：编辑 `palette.ts`；逐关源色仍由生成器输出。
- **调整精灵、拆线或回收演出**：编辑 `renderer.ts` 的角色半径、效果半径、任务时间与绘制函数；角色与线束尺度必须保持解耦，并复验行走、排队、异步回收和最密关性能。
- **调整布局、图鉴或结算**：编辑 `styles.css` 与 `ui/view.ts`，复验两种目标视口和 44px 触控门禁。
- **更换/移除排行榜平台**：实现 `platform/contracts.ts` 的端口并只修改 `create-platform-services.ts`；引擎和关卡无需改动。
- **调整存档字段与积分**：修改 `progress.ts` 的 schema/归一化/计分函数，并同步 `engine.ts` 的稳定节点快照；升级版本时必须保留旧最高关迁移。
- **修改音效/语言**：分别编辑 `audio.ts`、`i18n.ts`。
- **接入后台或分享**：新建独立模块并重新执行 API base、凭据、存储与双部署审计；核心玩法不得依赖头像权限。
