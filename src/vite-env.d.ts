interface ImportMetaEnv {
  readonly MODE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.mp3' {
  const src: string
  export default src
}

declare module '*.ogg' {
  const src: string
  export default src
}
