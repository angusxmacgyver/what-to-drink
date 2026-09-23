/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OWNER_PIN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.json" {
  const value: unknown;
  export default value;
}
