import { defineConfig, type Plugin } from 'vite'

const FAVICON = '<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 32 32\'%3E%3Ccircle cx=\'16\' cy=\'16\' r=\'12\' fill=\'%23f7f3ec\' stroke=\'%23241f1c\' stroke-width=\'3\'/%3E%3Ccircle cx=\'16\' cy=\'16\' r=\'6\' fill=\'none\' stroke=\'%23a67c2d\' stroke-width=\'2\'/%3E%3C/svg%3E" />'

function crazyGamesGuestHtml(): Plugin {
  return {
    name: 'crazygames-guest-html',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return html
          .replace('<html lang="zh-CN">', '<html lang="en">')
          .replace(/<title>[^<]*<\/title>/i, '<title>Unstitch Sprites</title>')
          .replace(/\s*<meta name="game-uuid"[^>]*>/i, '')
          .replace(/\s*<script\b[^>]*guest-shell\.js[^>]*>\s*<\/script>/i, '')
          .replace(
            /\s*<script\b[^>]*alteru-storage-scope\.js[^>]*>\s*<\/script>/i,
            '\n    <script>window.alteruLocalStorage=window.localStorage;window.alteruSessionStorage=window.sessionStorage;</script>',
          )
          .replace('src="./src/main.ts"', 'src="./src/main-cg.ts"')
          .replace('</head>', `    ${FAVICON}\n  </head>`)
      },
    },
  }
}

function stripGuestBrand(): Plugin {
  return {
    name: 'crazygames-strip-brand',
    apply: 'build',
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type === 'chunk') file.code = file.code.replaceAll('AlterU', 'Atelier')
        if (file.type === 'asset' && typeof file.source === 'string') {
          file.source = file.source.replaceAll('AlterU', 'Atelier')
        }
      }
    },
  }
}

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'crazygames' ? [crazyGamesGuestHtml(), stripGuestBrand()] : [],
  build: {
    outDir: mode === 'crazygames' ? 'dist-crazygames' : 'dist',
    emptyOutDir: true,
  },
}))
