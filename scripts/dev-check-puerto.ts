import dotenv from 'dotenv';
import net from 'net';

/**
 * Pre-check de `npm run dev`: avisa si el puerto destino ya está ocupado
 * antes de que Next levante en otro puerto en silencio.
 *
 * El caso que motiva esto: un `dev:e2e` residual ocupando :3000 sirve la
 * base E2E — el catálogo no coincide con el panel y las promos del seed no
 * tienen opcionales, dando la sensación de una regresión. El servidor E2E
 * se identifica por el header `x-e2e-server` que emite `next.config.ts`
 * cuando `E2E_SERVER_MARKER=e2e` (lo define `scripts/dev-e2e.ts`).
 *
 * Solo advierte (exit 0 siempre): levantar dev en otro puerto junto a un
 * servidor E2E es un caso de uso legítimo.
 */

dotenv.config({ path: '.env.local' });

const port = Number(process.env.PORT ?? 3000);
const host = '127.0.0.1';
const TCP_PROBE_MS = 1500;
const HTTP_PROBE_MS = 3000;

function tcpOpen(): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    const done = (open: boolean) => {
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(TCP_PROBE_MS);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

function warn(lines: string[]) {
  const width = Math.max(...lines.map((l) => l.length)) + 4;
  const border = '═'.repeat(width);
  console.warn(`\n╔${border}╗`);
  for (const line of lines) {
    console.warn(`║  ${line.padEnd(width - 2)}║`);
  }
  console.warn(`╚${border}╝\n`);
}

async function main() {
  if (!Number.isInteger(port) || port <= 0) {
    console.warn(`PORT="${process.env.PORT}" no es un puerto válido; se omite el chequeo.`);
    return;
  }

  if (!(await tcpOpen())) return;

  // El puerto acepta TCP: falta saber quién responde. `x-e2e-server` va en
  // todas las rutas (next.config.ts, source '/:path*'), así que un HEAD a
  // la raíz alcanza para identificar un servidor E2E.
  let e2e = false;
  let httpOk = false;
  try {
    const response = await fetch(`http://localhost:${port}/`, {
      method: 'HEAD',
      redirect: 'manual',
      signal: AbortSignal.timeout(HTTP_PROBE_MS),
    });
    httpOk = true;
    e2e = response.headers.get('x-e2e-server') === 'e2e';
  } catch {
    // Acepta TCP pero no respondió HTTP a tiempo (puede estar arrancando).
  }

  if (e2e) {
    warn([
      `AVISO: el puerto ${port} ya está ocupado por un servidor E2E`,
      '(npm run dev:e2e, base neondb_e2e — responde x-e2e-server).',
      '',
      'Este `npm run dev` va a levantar en OTRO puerto:',
      'usá la URL "Local:" que imprime Next abajo, no :' + port + '.',
      'Si entrás a :' + port + ' vas a ver datos de prueba E2E, no los tuyos.',
      '',
      'Para recuperar :' + port + ': cerrá el proceso dev:e2e que quedó vivo.',
    ]);
  } else if (httpOk) {
    warn([
      `AVISO: el puerto ${port} ya responde HTTP y no es un servidor E2E`,
      '(probablemente otro `next dev` o una app ajena).',
      '',
      'Este `npm run dev` va a levantar en OTRO puerto:',
      'usá la URL "Local:" que imprime Next abajo.',
    ]);
  } else {
    warn([
      `AVISO: el puerto ${port} acepta conexiones pero no responde HTTP`,
      '(puede ser un servidor todavía arrancando o un proceso ajeno).',
      '',
      'Este `npm run dev` puede fallar al bindear o moverse de puerto:',
      'usá la URL "Local:" que imprime Next abajo.',
    ]);
  }
}

main().catch((error) => {
  // El chequeo es una ayuda: nunca debe impedir levantar el dev server.
  console.warn('No se pudo verificar el puerto de desarrollo:', error);
});
