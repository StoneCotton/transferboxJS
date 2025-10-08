/// <reference types="vite/client" />

// Module declarations for audio files
declare module '*.mp3' {
  const src: string
  export default src
}
