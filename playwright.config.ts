import {defineConfig} from '@playwright/test';
process.env.PLAYWRIGHT_BROWSERS_PATH ||= `${process.cwd()}/.cache/ms-playwright`;
export default defineConfig({testDir:'./tests',testIgnore:'analytics.spec.ts',workers:1,timeout:40000,use:{baseURL:'http://127.0.0.1:4325',browserName:'chromium'},reporter:[['list'],['json',{outputFile:'output/qa/text/results.json'}]]});


