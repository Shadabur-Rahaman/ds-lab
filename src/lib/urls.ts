const prefix = import.meta.env.BASE_URL.replace(/\/$/, '');
export const appUrl = (path: string) => prefix + path;
export function appPath() {
 const path = window.location.pathname;
 const relative = prefix && (path === prefix || path.startsWith(prefix + '/')) ? path.slice(prefix.length) : path;
 return relative.replace(/\/+$/, '') || '/';
}
