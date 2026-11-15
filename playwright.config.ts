import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests',timeout:120000,workers:1,use:{baseURL:'http://127.0.0.1:5174'+(process.env.DS_LAB_BASE || '/'),headless:true},projects:[{name:'desktop',use:{viewport:{width:1440,height:1000}}},{name:'mobile',use:{viewport:{width:390,height:844},isMobile:true,hasTouch:true}}],reporter:'list'});
