// TypeScript 7 requires type declarations for side-effect CSS imports
// (TS2882). Next.js bundles the stylesheet; this only satisfies tsc.
declare module "*.css";
