type Locale = 'zh' | 'en'

const messages = {
  zh: {
    'game.title': '拆线精灵',
    'level.flower': '第一朵花',
    'level.moth': '月光小蛾',
    'hud.remaining': '待拆 {n}',
    'hint.start': '从外层开始，选现在够得到的颜色',
    'hint.first': '针脚拆掉，空路就打开了',
    'hint.wait': '这卷线还够不到外层，先在轴位等一等',
    'hint.normal': '看外层颜色，再选收线轴',
    'hint.danger': '轴位快满了，下一卷要能立刻拆线',
    'status.working': '拆线中',
    'status.waiting': '等待',
    'slot.empty': '空轴位',
    'tray.column': '第 {n} 列收线轴',
    'tray.spool': '{color}收线轴，还能收 {n} 针',
    'color.sun': '黄色',
    'color.coral': '红色',
    'color.leaf': '绿色',
    'color.lake': '蓝色',
    'color.violet': '紫色',
    'color.ink': '墨色',
    'action.soundOn': '打开声音',
    'action.soundOff': '关闭声音',
    'action.restart': '重来本关',
    'action.next': '下一幅',
    'action.again': '再拆一次',
    'complete.title': '藏在下面的是……',
    'complete.flower': '一颗刚醒来的小芽',
    'complete.moth': '一只收好月光的小蛾',
    'fail.title': '线缠住了',
    'fail.body': '五个轴位里的颜色，现在都够不到外层。',
    'fail.need': '外层现在需要：{colors}',
  },
  en: {
    'game.title': 'Unstitch Sprites',
    'level.flower': 'First Flower',
    'level.moth': 'Moonlit Moth',
    'hud.remaining': '{n} stitches left',
    'hint.start': 'Start outside. Pick a color the sprites can reach.',
    'hint.first': 'Removing a stitch opens a real path.',
    'hint.wait': 'This color cannot reach the edge yet, so it waits.',
    'hint.normal': 'Read the outer colors, then pick a reel.',
    'hint.danger': 'Reel rack nearly full. Pick one that can work now.',
    'status.working': 'Unstitching',
    'status.waiting': 'Waiting',
    'slot.empty': 'Empty reel slot',
    'tray.column': 'Reel stack {n}',
    'tray.spool': '{color} reel, capacity {n}',
    'color.sun': 'yellow',
    'color.coral': 'red',
    'color.leaf': 'green',
    'color.lake': 'blue',
    'color.violet': 'violet',
    'color.ink': 'charcoal',
    'action.soundOn': 'Turn sound on',
    'action.soundOff': 'Turn sound off',
    'action.restart': 'Restart level',
    'action.next': 'Next piece',
    'action.again': 'Unstitch again',
    'complete.title': 'Hidden underneath…',
    'complete.flower': 'a little sprout waking up',
    'complete.moth': 'a moth carrying moonlight',
    'fail.title': 'The threads tangled',
    'fail.body': 'None of the five waiting colors can reach the outer layer.',
    'fail.need': 'The outer layer needs: {colors}',
  },
} as const

type MessageKey = keyof typeof messages.zh

function detectLocale(): Locale {
  const override = alteruLocalStorage.getItem('game_locale')
  if (override === 'en' || override === 'zh') return override
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

export const locale = detectLocale()

export function t(key: string, vars: Record<string, string | number> = {}): string {
  let value: string = messages[locale][key as MessageKey] ?? messages.zh[key as MessageKey] ?? key
  Object.entries(vars).forEach(([name, replacement]) => {
    value = value.replace(`{${name}}`, String(replacement))
  })
  return value
}
