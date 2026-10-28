import {
  emptyToNull,
  getBrandDisplayName,
  getBrandLogoPath,
  isSafeBrandUrl,
  isValidCuit,
  normalizeCuit,
  splitBrandName,
} from './brand-helpers';

describe('brand-helpers', () => {
  test('valida el CUIT con o sin guiones y lo normaliza', () => {
    expect(isValidCuit('30-12345678-9')).toBe(true);
    expect(isValidCuit('30123456789')).toBe(true);
    expect(isValidCuit('30-1234567-9')).toBe(false);
    expect(isValidCuit('3O123456789')).toBe(false);
    expect(normalizeCuit('30123456789')).toBe('30-12345678-9');
  });

  test('acepta enlaces https o rutas internas y rechaza el resto', () => {
    expect(isSafeBrandUrl('https://www.ejemplo.com/terminos')).toBe(true);
    expect(isSafeBrandUrl('/terminos')).toBe(true);
    expect(isSafeBrandUrl('http://ejemplo.com')).toBe(false);
    expect(isSafeBrandUrl('//ejemplo.com')).toBe(false);
    expect(isSafeBrandUrl('/\\ejemplo.com')).toBe(false);
    expect(isSafeBrandUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeBrandUrl('no es una url')).toBe(false);
  });

  test('versiona la URL del logo con su fecha de actualización', () => {
    const updatedAt = new Date('2026-10-27T12:00:00.000Z');

    expect(getBrandLogoPath(null)).toBeNull();
    expect(getBrandLogoPath(updatedAt)).toBe(
      `/api/public/marca/logo?v=${updatedAt.getTime()}`
    );
    expect(getBrandLogoPath(updatedAt.toISOString())).toBe(
      `/api/public/marca/logo?v=${updatedAt.getTime()}`
    );
  });

  test('separa la primera palabra del nombre para el color de marca', () => {
    expect(splitBrandName('Pancheria Popular Centro')).toEqual({
      first: 'Pancheria',
      rest: 'Popular Centro',
    });
    expect(splitBrandName('   ')).toEqual({ first: '', rest: '' });
  });

  test('usa el nombre de marca y cae a la sucursal o a un texto genérico', () => {
    expect(
      getBrandDisplayName({ name: ' Pancheria Popular ' }, 'Av. Los Minerales')
    ).toBe('Pancheria Popular');
    expect(getBrandDisplayName({ name: '  ' }, 'Av. Los Minerales')).toBe(
      'Av. Los Minerales'
    );
    expect(getBrandDisplayName({ name: null })).toBe('Pedido online');
  });

  test('emptyToNull descarta los textos en blanco', () => {
    expect(emptyToNull('   ')).toBeNull();
    expect(emptyToNull(' hola ')).toBe('hola');
  });
});
