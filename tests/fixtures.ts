import {test as baseTest} from '@playwright/test';
import {existsSync, statSync} from 'node:fs';
import {resolve, sep} from 'node:path';

export {expect} from '@playwright/test';

export const test = baseTest.extend<{staticFiles: void}>({
 staticFiles: [async ({page}, use) => {
  if (process.env.DS_TEST_STATIC !== '1') { await use(); return; }
  const root = resolve('dist');
  const base = process.env.DS_LAB_BASE || '/';
  await page.route('http://127.0.0.1:5174/**', async (route) => {
   const requested = decodeURIComponent(new URL(route.request().url()).pathname);
   if (!requested.startsWith(base)) return route.fulfill({status:404});
   const pathname = '/' + requested.slice(base.length);
   const file = resolve(root, '.' + pathname);
   if (file !== root && !file.startsWith(root + sep)) return route.abort();
   if (existsSync(file) && statSync(file).isFile()) return route.fulfill({path:file});
   if (route.request().isNavigationRequest()) {
    const index = resolve(file, 'index.html');
    return route.fulfill({path:existsSync(index) ? index : resolve(root,'404.html')});
   }
   return route.fulfill({status:404});
  });
  await use();
 }, {auto: true}],
});
