/**
 * @jest-environment node
 */
import { getCspHeader } from './csp-helpers';

describe('csp-helpers', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('construye el header por defecto para entorno no productivo', () => {
    const header = getCspHeader('test-nonce');

    expect(header).toBe(
      "default-src 'self'; " +
        "script-src 'self' 'nonce-test-nonce' 'unsafe-eval' https://www.gstatic.com https://va.vercel-scripts.com; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: blob:; " +
        "media-src 'self' blob:; " +
        "connect-src 'self' https://www.gstatic.com; " +
        "font-src 'self'; " +
        "frame-src 'self'; " +
        "object-src 'none'; " +
        "base-uri 'self'; " +
        "form-action 'self'; " +
        "frame-ancestors 'none'"
    );
  });

  test('en producción elimina unsafe-eval y agrega upgrade-insecure-requests', () => {
    Object.assign(process.env, { NODE_ENV: 'production' });

    const header = getCspHeader('prod-nonce');

    expect(header).toContain(
      "script-src 'self' 'nonce-prod-nonce' https://www.gstatic.com https://va.vercel-scripts.com"
    );
    expect(header).not.toContain("'unsafe-eval'");
    expect(header).toContain('upgrade-insecure-requests');
  });

  test('agrega los orígenes de Vercel Blob cuando el proveedor es vercel-blob', () => {
    process.env.STORAGE_PROVIDER = 'vercel-blob';
    process.env.BLOB_READ_WRITE_TOKEN = 'test-token';

    const header = getCspHeader('nonce');

    expect(header).toContain('https://*.public.blob.vercel-storage.com');
    expect(header).toContain('https://vercel.com');
    expect(header).toContain('https://blob.vercel-storage.com');
  });

  test('agrega el origen de S3 cuando el proveedor es s3', () => {
    process.env.STORAGE_PROVIDER = 's3';
    process.env.S3_BUCKET = 'mi-bucket';
    process.env.S3_REGION = 'us-east-1';

    const header = getCspHeader('nonce');

    expect(header).toContain('https://mi-bucket.s3.us-east-1.amazonaws.com');
  });

  test('usa S3_ENDPOINT como origen cuando está configurado', () => {
    process.env.STORAGE_PROVIDER = 's3';
    process.env.S3_ENDPOINT = 'https://custom.s3.example.com:9000';

    const header = getCspHeader('nonce');

    expect(header).toContain('https://custom.s3.example.com:9000');
  });

  test('agrega el origen de R2 cuando el proveedor es r2', () => {
    process.env.STORAGE_PROVIDER = 'r2';
    process.env.R2_ACCOUNT_ID = 'mi-cuenta';

    const header = getCspHeader('nonce');

    expect(header).toContain('https://mi-cuenta.r2.cloudflarestorage.com');
  });

  test('incluye dominios externos permitidos en img-src', () => {
    process.env.PRODUCT_IMAGE_ALLOWED_EXTERNAL_DOMAINS = 'example.com, https://cdn.example.com';

    const header = getCspHeader('nonce');

    expect(header).toContain('https://example.com');
    expect(header).toContain('https://cdn.example.com');
  });

  test('prefija con https:// los dominios sin esquema', () => {
    process.env.PRODUCT_IMAGE_ALLOWED_EXTERNAL_DOMAINS = 'allowlisted.domain';

    const header = getCspHeader('nonce');

    expect(header).toContain('https://allowlisted.domain');
  });

  test('no incluye dominios vacíos ni duplicados por comas sueltas', () => {
    process.env.PRODUCT_IMAGE_ALLOWED_EXTERNAL_DOMAINS = ', , ';

    const header = getCspHeader('nonce');

    expect(header).toContain("img-src 'self' data: blob:");
  });
});
