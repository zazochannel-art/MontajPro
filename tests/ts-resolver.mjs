/**
 * Rezolvarea importurilor fără extensie, pentru testele care rulează codul
 * TypeScript direct.
 *
 * Aplicația scrie `./idb`, cum se obișnuiește într-un proiect cu bundler;
 * Node-ul, în schimb, cere calea completă. Hook-ul încearcă întâi `.ts`, apoi
 * lasă rezolvarea implicită să-și facă treaba.
 */
import { register } from "node:module";

register(
  "data:text/javascript," +
    encodeURIComponent(`
      export async function resolve(specifier, context, next) {
        const relative = specifier.startsWith('./') || specifier.startsWith('../');
        const hasExtension = /\\.[a-zA-Z0-9]+$/.test(specifier);
        if (relative && !hasExtension) {
          try {
            return await next(specifier + '.ts', context);
          } catch {
            try {
              return await next(specifier + '/index.ts', context);
            } catch {
              // cădem pe rezolvarea implicită
            }
          }
        }
        return next(specifier, context);
      }
    `),
  import.meta.url,
);
