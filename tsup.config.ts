import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/systems/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,          // optional: clears the output folder before build
  sourcemap: true,      // optional: generates source maps
  tsconfig: 'tsconfig.json',
});