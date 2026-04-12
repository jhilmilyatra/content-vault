/// <reference types="vite/client" />

declare namespace NodeJS {
  type Timeout = ReturnType<typeof globalThis.setTimeout>;
  type Timer = ReturnType<typeof globalThis.setTimeout>;
}
