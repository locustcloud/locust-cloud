import reactSwcPlugin from '@vitejs/plugin-react-swc';
import { defineConfig, UserConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

// https://vitejs.dev/config/
export default defineConfig((config: UserConfig) => ({
  plugins: [reactSwcPlugin(), tsconfigPaths()],
  base: './',
}));
