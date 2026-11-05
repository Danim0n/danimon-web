import {chromium} from '@playwright/test'; import path from 'node:path';
const browser=await chromium.launch({executablePath:path.resolve('.cache/ms-playwright/chromium-1248/chrome-win64/chrome.exe'),headless:true,args:['--enable-unsafe-swiftshader']});const page=await browser.newPage({viewport:{width:1440,height:1000}});await page.goto('http://127.0.0.1:4324/prototype/');await page.waitForTimeout(1500);console.log(await page.title());console.log(await page.locator('canvas').count());await page.screenshot({path:'output/qa/materia/prototype-check.png'});await browser.close();

