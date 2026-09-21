/**
 * Rezolvarea importurilor pentru testele care rulează codul TypeScript direct.
 *
 * Două lucruri pe care bundler-ul le face din oficiu, iar Node-ul nu:
 * importurile fără extensie (`./idb`) și aliasul `@/` către `src/`. Fără ele
 * ar trebui ca modulele testate să-și scrie importurile altfel decât restul
 * aplicației — adică să testăm alt cod decât cel care ajunge pe telefon.
 */
import { register } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as resolvePath } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const srcURL = pathToFileURL(resolvePath(here, "..", "src") + "/").href;

register(
  "data:text/javascript," +
    encodeURIComponent(`
      const SRC = ${JSON.stringify(srcURL)};

      export async function resolve(specifier, context, next) {
        let target = specifier;
        if (target.startsWith('@/')) {
          target = SRC + target.slice(2);
        }
        const relative =
          target.startsWith('./') || target.startsWith('../') || target.startsWith('file:');
        const hasExtension = /\\.[a-zA-Z0-9]+$/.test(target);
        if (relative && !hasExtension) {
          try {
            return await next(target + '.ts', context);
          } catch {
            try {
              return await next(target + '/index.ts', context);
            } catch {
              // cădem pe rezolvarea implicită
            }
          }
        }
        return next(target, context);
      }
    `),
  import.meta.url,
);
