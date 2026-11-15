import {defineConfig, loadEnv} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({mode}) => ({base:loadEnv(mode, '.', 'DS_LAB_').DS_LAB_BASE || '/',plugins:[react()],cacheDir:'.vite-cache',build:{target:'es2022'}}));
