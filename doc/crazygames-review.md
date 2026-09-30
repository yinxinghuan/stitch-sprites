# Unstitch Sprites — Crazy Games 游客版复验

本 PR 只修改 `crazygames` 构建。没有合并、没有向 Crazy Games 上传，也没有用 zip 替代外链页面。

## 本轮改动

- 将游客版游戏引擎、UI 与英文文案隔离到 `src/cg/`；宿主入口继续使用原文件，并增加宿主 SHA-256 硬门禁。
- 重新制作 40 张原创数学构图十字绣图案；首帧 `ladybug.png` 定稿后再批量生成。游客产物不再复用来源不可从仓库证明的 `public/patterns/`，也不含 `alteruBloom`。
- 保留五步可跳过/可重看教学；800×450、907×510、1920×1080 中教学卡不遮绣绷，第一步只有第 1 列可选。
- 章节规则改为可见且可执行的变化：1–10 五槽经典；11–20 四槽；21–30 每步换列；31–40 四槽并每步换列。上一列写入游客中途存档。
- 清关页立即显示下一图案与下一解锁。保留金币、Light Step / Quick Queue、四种道具与绣品册。
- Carefree 使用明确循环区间 00:00.030–03:24.430；设置页保留 Kevin MacLeod / CC BY 4.0 与 Kenney / CC0 署名。音量、用户静音继续持久化，SDK 强制静音不覆盖用户偏好。
- 接入 CrazyGames SDK v3 的初始化、loading start/stop、gameplay start/stop 与静音事件；没有广告调用。
- 外链审核目录为 `artifacts/crazygames/`；构建不再生成上传 zip。

## 图案版权清单

**保留旧 `public/patterns/`：无。** 旧图案引用的上游素材页不在仓库内，无法从 git 证明商业使用权，因此 Crazy Games 游客版全部替换。

**原创替换 40 张：**

1. ladybug → Crimson Kite
2. spellbook → Moss Lantern
3. slime → Ruby Compass
4. suitcase → Quiet Diamond
5. potion → Rose Window
6. lighthouse → Golden Orbit
7. deskFan → Meadow Shield
8. rollerSkate → Blue Petal
9. hotAirBalloon → Violet Gate
10. espressoMachine → Night Compass
11. koiSubmarine
12. cassettePlayer
13. trailBackpack
14. gameController
15. hillTerrarium
16. windupHummingbird
17. planetLunchbox
18. foodTruck
19. ribbonCamera
20. snowGlobe
21. lunarPod
22. submarinePorthole
23. domeBakery
24. jellyfishLamp
25. headphoneStand
26. weatherStation
27. deliveryScooter
28. recordShopCart
29. planetariumProjector
30. capsuleWorkshop
31. rocketClock
32. domeGreenhouse
33. glassOrrery
34. underwaterCabin
35. synthesizer
36. mobileLibrary
37. vendingMachine
38. campLantern
39. arcadeCabinet
40. moonPhaseClock

全部由 `scripts/generate-crazygames-patterns.py` 的数学轮廓、确定性颜色带和原创线轴规划生成，不描摹第三方十字绣。许可记录见 `src/cg/patterns/manifest.json` 和游客产物根目录 `THIRD_PARTY_NOTICES.txt`。AlterU logo 绣样继续从游客版排除。

## 宿主 SHA-256（改前 → 改后）

| 关键文件 | 改前 | 改后 |
| --- | --- | --- |
| `dist/index.html` | `10fe9034dd0e36a7256e2e472b95d35815de4208d076a27477f61af81f8fd02c` | `10fe9034dd0e36a7256e2e472b95d35815de4208d076a27477f61af81f8fd02c` |
| `dist/assets/index-JLPrKM9G.css` | `39754c2a45d704a38b609631ea4699bedffb1889ad9812ff5976458f68a65add` | `39754c2a45d704a38b609631ea4699bedffb1889ad9812ff5976458f68a65add` |
| `dist/assets/index-DAzv1NZE.js` | `b106480738d4c82e3a4c07f895dac2a6324f7f2e9bab8be97a8ba4911c48b37a` | `b106480738d4c82e3a4c07f895dac2a6324f7f2e9bab8be97a8ba4911c48b37a` |
| `dist/alteru-storage-scope.js` | `7dc73a406c88605cab3b3a06d99380a638d7218d652f4b26b10c86bab2cd54bc` | `7dc73a406c88605cab3b3a06d99380a638d7218d652f4b26b10c86bab2cd54bc` |
| `dist/alteru.svg` | `4a4186a41df361ef97db7c6337752fd8a901d140b86541807134e01600a6dc4c` | `4a4186a41df361ef97db7c6337752fd8a901d140b86541807134e01600a6dc4c` |
| `dist/poster.png` | `3670fbbca215bba38bb161c77cda72d9878b7773beff5bbf2e5a354fed6aeb6e` | `3670fbbca215bba38bb161c77cda72d9878b7773beff5bbf2e5a354fed6aeb6e` |

## 前 10 关浏览器回放

计时为真实引擎 + 无头浏览器 RAF、压缩等待时长的自动回放，不是玩家自然手速。

| 关卡 | 秒 | 失败点 | 无解 |
| ---: | ---: | --- | --- |
| 1 | 16.98 | 无 | 否 |
| 2 | 21.08 | 无 | 否 |
| 3 | 22.49 | 无 | 否 |
| 4 | 20.36 | 无 | 否 |
| 5 | 25.98 | 无 | 否 |
| 6 | 22.14 | 无 | 否 |
| 7 | 20.11 | 无 | 否 |
| 8 | 28.75 | 无 | 否 |
| 9 | 25.44 | 无 | 否 |
| 10 | 16.09 | 无 | 否 |

40 关静态权威解也全部通过，覆盖 10 关 classic、10 关 tight-rack、10 关 alternate、10 关 combined。

## 加载与截图证据

首屏实测传输 **192,801 bytes**：HTML 1,254、CSS 28,417、JS 161,420、当前第 1 关图案 1,710。音乐与其余 39 张图案没有在标题首屏请求。

- 800×450：[标题](../_qa/ui/crazygames-final/800x450-title.png) · [教学](../_qa/ui/crazygames-final/800x450-tutorial.png) · [中局](../_qa/ui/crazygames-final/800x450-mid.png) · [清关](../_qa/ui/crazygames-final/800x450-complete.png) · [绣品册](../_qa/ui/crazygames-final/800x450-album.png)
- 907×510：[标题](../_qa/ui/crazygames-final/907x510-title.png) · [教学](../_qa/ui/crazygames-final/907x510-tutorial.png) · [中局](../_qa/ui/crazygames-final/907x510-mid.png) · [清关](../_qa/ui/crazygames-final/907x510-complete.png) · [绣品册](../_qa/ui/crazygames-final/907x510-album.png)
- 1920×1080：[标题](../_qa/ui/crazygames-final/1920x1080-title.png) · [教学](../_qa/ui/crazygames-final/1920x1080-tutorial.png) · [中局](../_qa/ui/crazygames-final/1920x1080-mid.png) · [清关](../_qa/ui/crazygames-final/1920x1080-complete.png) · [绣品册](../_qa/ui/crazygames-final/1920x1080-album.png)

三档均无控制台错误、无按钮/教学文字裁切、无页面溢出、教学卡与绣绷重叠面积为 0；SDK stub 均收到 init、loadingStart、loadingStop、gameplayStart、gameplayStop。

## 仍未把握 / 未执行

- 没有新的真人玩家复述或行为证据，首次教学理解度仍为 **comprehension unverified**；自动化只能证明路径与限制可执行。
- SDK 生命周期在本地用官方接口形状的 stub 验证，尚未在 Crazy Games 后台预览环境验证。
- 没有上传 Crazy Games，没有触发广告，也没有合并本 PR。

## 2026-09-30 审图修正

- 中局可见精灵从“每批最多 4 只”收紧为“全局最多 4 只”，并在绣绷下缘分散；800×450 复拍中只出现 2 只，未遮挡风筝主体。
- 四列线轴现在同时显示英文线色、剩余 stitches 与 READY/WAIT；教学第一步仅第 1 列可点，其他三列明显灰化。
- 40 张原创图案改为 40 个不同物件轮廓；前 10 张在 800×450 绣品册同屏显示且 Canvas 像素签名两两不同。
- 新证据：`_qa/ui/crazygames-final/800x450-mid.png`、`800x450-tutorial.png`、`800x450-album.png`。
