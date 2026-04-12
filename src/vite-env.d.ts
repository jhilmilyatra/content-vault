/// <reference types="vite/client" />

// Polyfill NodeJS namespace for timer types used across the app
declare global {
  namespace NodeJS {
    interface Timeout extends ReturnType<typeof setTimeout> {}
  }
}

export {};
