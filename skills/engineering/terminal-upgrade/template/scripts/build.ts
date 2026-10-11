/** `pnpm build`: write dist/devdeck.mjs. The bundling itself lives in bundle.ts. */
import { bundle } from './bundle.ts';

bundle()
  .then((file) => process.stdout.write(`${file}\n`))
  .catch((err: unknown) => {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
