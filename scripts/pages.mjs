import {copyFileSync, mkdirSync} from 'node:fs';

// Pages serves directory indexes for links opened directly or refreshed.
const routes = ['dashboard', 'courses', 'roadmap', 'learn/introduction', 'learn/statistics', 'learn/pandas', 'projects/iris'];
for (const route of routes) {
 const directory = `dist/${route}`;
 mkdirSync(directory, {recursive: true});
 copyFileSync('dist/index.html', `${directory}/index.html`);
}
copyFileSync('dist/index.html', 'dist/404.html');
