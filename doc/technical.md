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
    levels.ts                    组装正式 42 关，并保存隔离的双入口／六色圆环实验关
    generated-patterns.ts        生成的网格、逐关调色板、四列线轴与解法
    reachability.ts              外部洪泛、可达颜色、目标与步行路径
    renderer.ts                  Canvas 静态缓存、源纹理遮罩、精灵与线束动画
    palette.ts                   六种玩法色、符号及逐关色板解析
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
  patterns/<key>.png             42 张透明高清十字绣纹理
  alteru-storage-scope.js        自托管 session 隔离存储适配器
scripts/
  generate-stitch-patterns.py    裁图、原生针点、无飞地、纹理和关卡数据生成
doc/references/
  chapter-*-candidate-*.png      已接受源素材页
  topology-challenge-candidates-v1.png  拓扑挑战章的 8 图概念母版
  level-square-audit/            每关独立 1:1 裁切审核图
  generated-pattern-order.md     当前颜色/复杂度排序证据
_qa/
  solve-levels.ts                42 关解法与失败路径回放
  dual-entry-lab.ts              双入口、双可恢复路线与槽位差异门禁
  capture-dual-entry-lab.mjs     实验关双尺寸、压力态与结算截图
  multi-ring-lab.ts              18 圈安全路线与玩家选择卡死的完整网格回放
  multi-ring-strategy-sim.ts     三种人类近似策略的批量牌序压力统计
  capture-multi-ring-lab.mjs     六色圆环双尺寸初始态与失败态截图
  progress-migration.ts          v2 存档到 v3 牌序迁移回归
  feature-regression.mjs         首动风险、稳定存档、可选榜单与双击缩放回归
  capture-levels.mjs             全关截图、溢出和卡牌均衡检查
  capture.mjs                    首动、完成、失败、窄屏、外部访客流程
  capture-gallery.mjs            42 张图鉴、底部滚动稳定与解锁检查
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
5. 用增量外部洪泛离线生成可拆顺序和线轴容量；第 3 关起把同色段交替放入两列，避免旧版“一列点到底”。
6. 第 10 关起按关卡结构合并跨层同色线轴，让正确线轴也可能保留容量等待后续开路；第 10／27／35 关分别强制验证 1／2／3 个等待槽。
7. 原 35 关继续按颜色数分章并保持稳定编号；挑战章只追加 36–42 关，防止老存档的逐关最好分错位。
8. 挑战章先用带一格运行时外边界的洪泛把最外三层统一为一个入口色，并只对改色针格做保留明暗和纤维的色相重映射；原图内部纹理不重绘。
9. 36–42 关分别固定标准解峰值等待 1／1／2／2／3／3／4；生成后仍由 TypeScript 权威规则回放解法和五步失败路径。

线轴方案必须离线生成。旧实现曾在页面启动时计算整套关卡，导致高密度数据初始化超过 30 秒；当前运行时只读取 42 关预生成结果，模块初始化约 0.1 秒。

### 状态与规则

`GameEngine` 持有当前关、逻辑格、四列线轴、五个活动槽、阶段和已拆数。`selectColumn()` 立即把顶部线轴送入槽位，然后 `processWork()` 循环：

- `findReachable()` 从棋盘外部穿过空格和已拆格洪泛。
- 每个工作线轴一次派 4–12 个精灵，并用共享路径图寻找真实步行路线。当前 1.0× 基线为 560–1180ms 去程、190ms 出队间隔和 170ms 逻辑释放延时；常量集中在 `engine.ts`，可供后续有上限的速度档位缩放。
- 任务抵达后才清除逻辑格、减少容量并批量发出状态更新。
- 容量归零移除线轴；无剩余格进入完成；五槽满且无任务进入失败。

第 1 关只在第一次输入强制正确列；第一次真实拆线后，所有关卡都允许错误颜色进入等待轴位。第 1–2 关首次五槽堵塞会展示 650ms 后自动退回最后一卷，第 3 关起进入真实失败。

`DUAL_ENTRY_LAB_LEVEL` 是不属于正式关卡生成流水线的机制探针。只有 URL 同时包含 `lab=dual-entry` 与 `level=42` 时，`main.ts` 才在完成正式关卡验证后临时把运行时第 42 关替换为实验关。实验关不加载高清纹理，直接使用逻辑针点；显式关卡查询使引擎不读取/写入中途局，入口同时关闭远程合并、排行榜展示与提交。两个外露入口都可立即拆线并最终通关，但权威回放固定验证低压力路线峰值等待 0、高压力路线峰值等待 2，避免把假选择或死路误当成路线决策。

`MULTI_RING_LAB_LEVEL` 通过 `?lab=multi-ring&level=42` 使用同一隔离路径。当前实验关是 73×73、3969 针、18 个完整同心圈；六种颜色各出现三次并改变回返次序。四列首牌为蓝／红／绿／黄，保证蓝色最外圈有直接可执行的第一步。18 张牌的权威安全路线峰值占槽为 4，可完整清空；`[0,1,2,3,0,1,2,3,2,3,2]` 则在第 11 次选择后留下 1757 针和五个等待线轴，唯一可达色为红色。`_qa/multi-ring-strategy-sim.ts` 以 10,000 个固定种子比较均匀选择、只匹配当前首牌、查看一张背牌三种策略；统计模型只用于筛选牌序，最终仍由完整网格回放和真实界面确认可解与卡死。

`progress.ts` 以版本化 `PersistedProgress` 保存最高解锁关、逐关最佳绣艺分和当前稳定关卡状态。引擎只在关卡载入或整批任务结算后写入，保存已拆格索引、四列、五槽和本局决策统计；动画中途关闭会回到上一稳定节点。难度 v2 把 schema 升到版本 3：读取 v2 时保留已解锁关、最佳分和预留经济字段，但清空与旧牌序不兼容的 `currentRun`。追加 36–42 关不再改变 schema：只有最高解锁为 35 且已存在第 35 关最好成绩的旧终章完成者迁移到解锁 36，仅解锁未完成者仍停在 35。`alteruLocalStorage` 负责同部署 UUID 的本地隔离；平台适配器存在时以 1 秒防抖同步相同 JSON 到 Aigram 云存档。云数据只在本次尚无玩家操作时接管当前局，本地与云端的解锁关和逐关最好分始终取并集/最大值。

绣艺分不使用时间：单关为 `1000 + levelId × 25 + 零错误奖励 250 + 无帮助奖励 250`，每关只保留最好一次，总分为逐关最好分之和。这样金币、广告和未来速度升级不会改变排行榜公平性。

### 渲染与性能

`BoardRenderer` 使用三层 Canvas：

- `baseCanvas`：木绷和织物，只在尺寸/关卡变化时重画。
- `staticCanvas`：源十字绣纹理按未清除格的 `Path2D` 遮罩绘制；清除时只从底层回填对应格。
- 可见 Canvas：每帧合成静态层，再绘制活动精灵、工具、线束和洞口反馈。

源纹理通过 `new URL('./patterns/<key>.png', document.baseURI)` 加载，兼容任意部署子路径。纹理未完成加载时使用逻辑针点后备绘制；成功后一次 `drawImage` 进入遮罩，不逐针重绘高清图。无动态任务时停止 RAF。进入完成/失败时清空残余任务，防止结算后角色堆积。

最新压力证据：最密第 42 关、390×844、2× DPR、6× CPU 限速，输入派发 22.5ms，首个可见响应 27.5ms，平均帧间隔 8.91ms，p95 10.3ms，最差 41.6ms，无 >50ms 帧。

### UI、输入、音频与 i18n

`GameView` 渲染紧凑 HUD、五槽、四列牌、绣品册、结果层和可选榜单。绣品册打开时按已解锁最高关缓存其 DOM，不因引擎动画帧重复重建而改变 `scrollTop`；未解锁卡片只渲染编号与锁，不创建图案 Canvas。游戏牌用 `pointerdown`；可滚动绣品册和榜单使用 `click`。根游戏区域用 `touch-action: manipulation` 并阻止默认 `dblclick`，保留两次游戏输入但不触发页面放大；滚动层恢复 `pan-y pinch-zoom`。所有可见文案经过 `t()`，支持 zh/en。音频在首次手势后解锁，失败时静默降级，不参与权威状态更新。

游戏没有自有玩法后台、头像或微信权限依赖。核心引擎只接收 `ProgressRepository`，不导入 Aigram；`PlatformServices` 在入口组合本地仓库与可选平台能力。没有有效宿主身份时 `leaderboard` 为 `null`，榜首入口和榜单完全不渲染；移除 `src/platform/` 并改为 `LocalProgressRepository` 后仍可完整运行。Aigram 环境按当前游戏 UUID 提交总绣艺分、展示榜首/完整榜单/自己标记，并只向本次刚超过的最高分用户发送 `score_beat`。Pages 仍是同 commit 的静态前端镜像，默认退化为本地存档且无榜单。

## 4. 扩展点

- **新增/替换图案**：把素材页放入 `doc/references/`，更新生成脚本 `SOURCES`，运行生成器；不要手改 `generated-patterns.ts` 或 `public/patterns/`。
- **调整难度排序与每关选择数**：修改生成脚本的同章排序键、`target_selections()`、`requested_carry_reels()`、`CHALLENGE_CARRY_TARGETS` 或 `RUN_COLUMN_PAIRS`，重新生成并跑全关解法、五步失败路径和 v2 存档迁移。
- **调整双入口实验**：只修改 `levels.ts` 的 `DUAL_ENTRY_LAB_LEVEL` 与 `_qa/dual-entry-lab.ts` 的两条权威路线；正式 `GENERATED_PATTERNS`、42 关编号和线上进度不得随实验变化。
- **调整六色圆环实验**：只修改 `levels.ts` 的 `MULTI_RING_LAB_LEVEL`、`_qa/multi-ring-lab.ts` 与策略模拟；必须同时复验蓝色首牌、18 张牌安全解、玩家选择卡死、三类策略差异及双尺寸失败／结算画面。
- **修改可达/失败规则**：编辑 `reachability.ts` 与 `engine.ts`，同步更新生成器中的离线洪泛合同。
- **调整颜色和符号**：编辑 `palette.ts`；逐关源色仍由生成器输出。
- **调整精灵、拆线或回收演出**：编辑 `renderer.ts` 的任务时间与绘制函数；必须复验行走、异步回收和最密关性能。
- **调整布局、图鉴或结算**：编辑 `styles.css` 与 `ui/view.ts`，复验两种目标视口和 44px 触控门禁。
- **更换/移除排行榜平台**：实现 `platform/contracts.ts` 的端口并只修改 `create-platform-services.ts`；引擎和关卡无需改动。
- **调整存档字段与积分**：修改 `progress.ts` 的 schema/归一化/计分函数，并同步 `engine.ts` 的稳定节点快照；升级版本时必须保留旧最高关迁移。
- **修改音效/语言**：分别编辑 `audio.ts`、`i18n.ts`。
- **接入后台或分享**：新建独立模块并重新执行 API base、凭据、存储与双部署审计；核心玩法不得依赖头像权限。
