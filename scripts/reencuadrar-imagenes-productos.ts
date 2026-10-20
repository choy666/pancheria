import { existsSync } from 'fs';
import path from 'path';

/**
 * Re-encuadra las imágenes de producto ya publicadas para igualar el zoom
 * aparente entre escenas de /pantalla y cards del catálogo.
 *
 * Por qué existe: históricamente las imágenes se subieron con formatos y
 * márgenes internos distintos (~1:1, 16:9, aire variable alrededor del
 * producto), y la tarjeta mostraba el lienzo completo con `object-contain`,
 * así que el producto se veía con zoom distinto en cada escena. El
 * normalizador del panel (`src/lib/product-image-normalize.ts`) ahora
 * recorta el aire uniforme del fondo y encuadra en lienzo fijo 16:9
 * (1200×675); este script aplica la MISMA transformación a los PNG
 * originales del catálogo y las publica a través del pipeline real de la
 * app (preparar → put al blob → PUT producto), que verifica la firma del
 * archivo y borra la imagen anterior automáticamente.
 *
 * Uso:
 *   npx tsx scripts/reencuadrar-imagenes-productos.ts \
 *     --branch <id> --dir <carpeta-pngs> [--env .env.local] [--base-url <url>]
 *     [--apply]
 *
 * - Por defecto corre en dry-run: normaliza cada archivo, valida contra la
 *   API qué productos matchean y no escribe nada.
 * - `--apply` sube las imágenes ya normalizadas y actualiza los productos.
 * - Credenciales: ADMIN_USERNAME / ADMIN_PASSWORD del archivo `--env`
 *   (por defecto `.env.local`). La URL base sale de `NEXTAUTH_URL`/`AUTH_URL`
 *   del mismo archivo, o de `--base-url`.
 * - `--branch` se envía como cookie `activeBranchId` (el admin opera sobre
 *   la sucursal indicada, igual que el selector del panel).
 */

// Mapa nombre de producto (normalizado) → archivo dentro de --dir.
const PRODUCT_FILE_MAP: Record<string, string> = {
  'vaso de gaseosa': 'vaso_gaseosa.png',
  'agregado de toppings': 'toppings.png',
  'super pancho': 'pancho.png',
  'promo 1': 'promo1.png',
  'promo 2': 'promo2.png',
  'promo pritty 1': 'promo_pritty.png',
  'promo pritty 2': 'promo_pritty2.png',
  'promo amigos 1': 'promo_amigos1.png',
  'promo amigos 2': 'promo_amigos2.png',
  'promo popular': 'promo_popular.png',
  'promo familiar': 'promo_familiar.png',
  'promo familiar plus': 'promo_familiar_plus.png',
  'cerveza chica 475 ml': 'quilmes.png',
  'popu kids': 'popu_kids.png',
};

// Mismos parámetros que src/lib/product-image-normalize.ts.
const TARGET_WIDTH = 1200;
const TARGET_HEIGHT = 675;
const WEBP_QUALITY = 80; // PRODUCT_IMAGE_WEBP_QUALITY 0.8 → sharp 0-100
const TRIM_SCAN_MAX_EDGE = 800;
const TRIM_ALPHA_MIN = 128;
const TRIM_COLOR_TOLERANCE = 30;
const TRIM_PAD_RATIO = 0.1;
const TRIM_MIN_GAIN_RATIO = 0.03;

interface Args {
  apply: boolean;
  branch: number | null;
  dir: string | null;
  envFile: string;
  baseUrl: string | null;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    apply: false,
    branch: null,
    dir: null,
    envFile: '.env.local',
    baseUrl: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    switch (argv[i]) {
      case '--apply':
        args.apply = true;
        break;
      case '--branch':
        args.branch = Number(argv[++i]);
        break;
      case '--dir':
        args.dir = argv[++i];
        break;
      case '--env':
        args.envFile = argv[++i];
        break;
      case '--base-url':
        args.baseUrl = argv[++i];
        break;
      default:
        throw new Error(`Argumento desconocido: ${argv[i]}`);
    }
  }
  return args;
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ————————————————————————————————————————————————————————————————————
// Normalización (réplica server-side de product-image-normalize.ts)
// ————————————————————————————————————————————————————————————————————

interface ContentFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

function findContentBounds(
  data: Buffer,
  width: number,
  height: number,
  channels: number
): ContentFrame | null {
  const px = (x: number, y: number) => (y * width + x) * channels;
  const alphaAt = (i: number) => (channels === 4 ? data[i + 3] : 255);

  const corners = [px(0, 0), px(width - 1, 0), px(0, height - 1), px(width - 1, height - 1)];
  let transparentCorners = 0;
  let br = 0;
  let bg = 0;
  let bb = 0;
  let opaqueCorners = 0;
  for (const i of corners) {
    if (alphaAt(i) < TRIM_ALPHA_MIN) transparentCorners += 1;
    else {
      br += data[i];
      bg += data[i + 1];
      bb += data[i + 2];
      opaqueCorners += 1;
    }
  }
  const transparentBg = transparentCorners > corners.length / 2;
  if (opaqueCorners > 0) {
    br /= opaqueCorners;
    bg /= opaqueCorners;
    bb /= opaqueCorners;
  }

  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = px(x, y);
      if (alphaAt(i) < TRIM_ALPHA_MIN) continue;
      if (!transparentBg) {
        const diff = Math.max(
          Math.abs(data[i] - br),
          Math.abs(data[i + 1] - bg),
          Math.abs(data[i + 2] - bb)
        );
        if (diff <= TRIM_COLOR_TOLERANCE) continue;
      }
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX || maxY < minY) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

interface NormalizedImage {
  buffer: Buffer;
  frame: ContentFrame;
  trimmed: boolean;
}

async function normalizeProductImage(filePath: string): Promise<NormalizedImage> {
  const sharp = (await import('sharp')).default;
  const image = sharp(filePath);
  const meta = await image.metadata();
  const sourceWidth = meta.width ?? 0;
  const sourceHeight = meta.height ?? 0;
  if (sourceWidth < 1 || sourceHeight < 1) {
    throw new Error(`Imagen sin dimensiones válidas: ${filePath}`);
  }

  const scale = Math.min(1, TRIM_SCAN_MAX_EDGE / Math.max(sourceWidth, sourceHeight));
  const scanWidth = Math.max(1, Math.round(sourceWidth * scale));
  const scanHeight = Math.max(1, Math.round(sourceHeight * scale));
  const { data, info } = await sharp(filePath)
    .resize(scanWidth, scanHeight)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const bounds = findContentBounds(data, info.width, info.height, info.channels);

  let frame: ContentFrame = { x: 0, y: 0, width: sourceWidth, height: sourceHeight };
  let trimmed = false;
  if (bounds) {
    const inv = 1 / scale;
    const pad = Math.max(bounds.width, bounds.height) * TRIM_PAD_RATIO;
    const x = Math.max(0, Math.floor((bounds.x - pad) * inv));
    const y = Math.max(0, Math.floor((bounds.y - pad) * inv));
    const x2 = Math.min(sourceWidth, Math.ceil((bounds.x + bounds.width + pad) * inv));
    const y2 = Math.min(sourceHeight, Math.ceil((bounds.y + bounds.height + pad) * inv));
    const candidate = { x, y, width: x2 - x, height: y2 - y };
    const gain = 1 - (candidate.width * candidate.height) / (sourceWidth * sourceHeight);
    if (gain >= TRIM_MIN_GAIN_RATIO) {
      frame = candidate;
      trimmed = true;
    }
  }

  // Contain-fit del frame en el lienzo 16:9 sobre fondo blanco opaco: el
  // aire del producto comparte el mismo escenario en todas las cards (un
  // lienzo transparente dejaba ver el gradiente de marca y se veía desparejo).
  const fitScale = Math.min(TARGET_WIDTH / frame.width, TARGET_HEIGHT / frame.height);
  const drawW = Math.max(1, Math.round(frame.width * fitScale));
  const drawH = Math.max(1, Math.round(frame.height * fitScale));
  const dx = Math.round((TARGET_WIDTH - drawW) / 2);
  const dy = Math.round((TARGET_HEIGHT - drawH) / 2);

  const cropped = await sharp(filePath)
    .extract({ left: frame.x, top: frame.y, width: frame.width, height: frame.height })
    .resize(drawW, drawH, { fit: 'fill' })
    .toBuffer();

  const buffer = await sharp({
    create: {
      width: TARGET_WIDTH,
      height: TARGET_HEIGHT,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: cropped, left: dx, top: dy }])
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  return { buffer, frame, trimmed };
}

// ————————————————————————————————————————————————————————————————————
// Cliente HTTP mínimo con cookie jar
// ————————————————————————————————————————————————————————————————————

class Session {
  private cookies = new Map<string, string>();

  constructor(private baseUrl: string) {}

  private cookieHeader(): string {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  private storeCookies(res: Response): void {
    for (const raw of res.headers.getSetCookie()) {
      const [pair] = raw.split(';');
      const eq = pair.indexOf('=');
      if (eq > 0) this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }

  setCookie(name: string, value: string): void {
    this.cookies.set(name, value);
  }

  hasCookieMatching(fragment: string): boolean {
    return [...this.cookies.keys()].some((name) => name.includes(fragment));
  }

  async request(
    path: string,
    init: { method?: string; json?: unknown; form?: URLSearchParams } = {}
  ): Promise<{ status: number; body: unknown }> {
    const headers: Record<string, string> = { cookie: this.cookieHeader() };
    let body: string | undefined;
    if (init.json !== undefined) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(init.json);
    } else if (init.form) {
      headers['content-type'] = 'application/x-www-form-urlencoded';
      body = init.form.toString();
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      method: init.method ?? 'GET',
      headers,
      body,
      redirect: 'manual',
    });
    this.storeCookies(res);

    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      // HTML de redirect u otra respuesta no-JSON: se devuelve cruda.
    }
    return { status: res.status, body: parsed };
  }
}

async function login(
  session: Session,
  username: string,
  password: string
): Promise<void> {
  const csrf = await session.request('/api/auth/csrf');
  const csrfToken = (csrf.body as { csrfToken?: string })?.csrfToken;
  if (!csrfToken) {
    throw new Error(`No se pudo obtener el CSRF token (status ${csrf.status}).`);
  }

  const form = new URLSearchParams({
    csrfToken,
    username,
    password,
    json: 'true',
  });
  const res = await session.request('/api/auth/callback/credentials', {
    method: 'POST',
    form,
  });
  if (!session.hasCookieMatching('session-token')) {
    throw new Error(
      `Login falló (status ${res.status}): ${JSON.stringify(res.body).slice(0, 200)}`
    );
  }
}

// ————————————————————————————————————————————————————————————————————
// Flujo principal
// ————————————————————————————————————————————————————————————————————

interface ApiProduct {
  id: number;
  name: string;
  imageUrl: string | null;
  imageKey: string | null;
}

async function listAllProducts(session: Session): Promise<ApiProduct[]> {
  const items: ApiProduct[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const res = await session.request(`/api/productos?page=${page}&limit=100`);
    if (res.status !== 200) {
      throw new Error(`GET /api/productos falló (status ${res.status}).`);
    }
    const body = res.body as { items?: ApiProduct[] };
    const pageItems = body.items ?? [];
    items.push(...pageItems);
    if (pageItems.length < 100) break;
  }
  return items;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (!existsSync(args.envFile)) {
    throw new Error(`No existe el archivo de entorno: ${args.envFile}`);
  }
  const dotenv = await import('dotenv');
  dotenv.config({ path: args.envFile });

  const baseUrl = (args.baseUrl ?? process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? '')
    .trim()
    .replace(/\/$/, '');
  if (!baseUrl) {
    throw new Error('Falta la URL base: pasá --base-url o definí AUTH_URL/NEXTAUTH_URL.');
  }
  if (!args.branch || args.branch <= 0) {
    throw new Error('Falta --branch <id> (sucursal sobre la que opera el admin).');
  }
  if (!args.dir) {
    throw new Error('Falta --dir <carpeta> con los PNG del catálogo.');
  }
  const dir = path.resolve(args.dir);
  if (!existsSync(dir)) {
    throw new Error(`No existe la carpeta de imágenes: ${dir}`);
  }
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD?.trim();
  if (!username || !password) {
    throw new Error('Faltan ADMIN_USERNAME/ADMIN_PASSWORD en el archivo de entorno.');
  }

  console.log(`\nBase URL: ${baseUrl} | sucursal: ${args.branch} | dir: ${dir}`);
  console.log(args.apply ? 'MODO APPLY: se suben y persisten las imágenes.\n' : 'MODO DRY-RUN: no se escribe nada.\n');

  const session = new Session(baseUrl);
  await login(session, username, password);
  session.setCookie('activeBranchId', String(args.branch));
  console.log('Login OK.');

  const products = await listAllProducts(session);
  const withImage = products.filter((p) => p.imageUrl || p.imageKey);
  console.log(`Productos en la sucursal: ${products.length} | con imagen: ${withImage.length}\n`);

  // Cruzar productos ↔ archivos del mapa.
  const plan: { product: ApiProduct; filePath: string; normalized: NormalizedImage }[] = [];
  const warnings: string[] = [];

  for (const product of products) {
    const file = PRODUCT_FILE_MAP[normalizeName(product.name)];
    if (!file) continue;

    if (!product.imageUrl && !product.imageKey) {
      warnings.push(`${product.name} (id ${product.id}) no tiene imagen: se omite (este script no agrega imágenes nuevas).`);
      continue;
    }

    const filePath = path.join(dir, file);
    if (!existsSync(filePath)) {
      warnings.push(`${product.name} (id ${product.id}): falta el archivo ${file}.`);
      continue;
    }

    const normalized = await normalizeProductImage(filePath);
    plan.push({ product, filePath, normalized });
    console.log(
      `  ${product.name} (id ${product.id}) ← ${file} | recorte ${trimmedLabel(normalized)} | salida ${(normalized.buffer.length / 1024).toFixed(0)} KB webp 1200x675`
    );
  }

  const unmapped = withImage.filter((p) => !PRODUCT_FILE_MAP[normalizeName(p.name)]);
  for (const p of unmapped) {
    warnings.push(`${p.name} (id ${p.id}) tiene imagen pero ningún archivo en el mapa.`);
  }
  for (const w of warnings) console.warn(`\n⚠ ${w}`);

  console.log(`\nPlan: ${plan.length} imágenes a re-encuadrar.`);
  if (!args.apply) {
    console.log('Dry-run completo. Volvé a correr con --apply para escribir.');
    return;
  }

  // Apply: preparar → put al blob → PUT producto (la API verifica la firma y
  // borra la imagen anterior en la misma operación).
  for (const { product, filePath, normalized } of plan) {
    const name = path.basename(filePath).replace(/\.[^.]+$/, '') + '.webp';
    const prep = await session.request('/api/productos/imagen/preparar', {
      method: 'POST',
      json: {
        productId: product.id,
        name,
        type: 'image/webp',
        size: normalized.buffer.length,
      },
    });
    if (prep.status !== 200) {
      console.error(`✗ ${product.name}: preparar falló (${prep.status}) ${JSON.stringify(prep.body).slice(0, 160)}`);
      continue;
    }
    const instructions = prep.body as { token?: string; key: string };
    if (!instructions.token || !instructions.key) {
      console.error(`✗ ${product.name}: preparar no devolvió token/key (provider distinto a vercel-blob?).`);
      continue;
    }

    const client = await import('@vercel/blob/client');
    const blob = await client.put(instructions.key, normalized.buffer, {
      access: 'public',
      token: instructions.token,
    });

    const put = await session.request(`/api/productos/${product.id}`, {
      method: 'PUT',
      json: {
        imageUrl: blob.url,
        imageKey: instructions.key,
        imageMimeType: 'image/webp',
        imageSize: normalized.buffer.length,
      },
    });
    if (put.status !== 200) {
      console.error(`✗ ${product.name}: PUT producto falló (${put.status}) ${JSON.stringify(put.body).slice(0, 160)}`);
      continue;
    }
    console.log(`✓ ${product.name}: ${instructions.key} (${(normalized.buffer.length / 1024).toFixed(0)} KB)`);
  }

  console.log('\nListo.');
}

function trimmedLabel(n: NormalizedImage): string {
  return n.trimmed ? `${n.frame.width}x${n.frame.height}+(${n.frame.x},${n.frame.y})` : 'sin recorte';
}

main().catch((error) => {
  console.error(`\n✗ ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
