import { buildBranchRestaurantJsonLd, serializeJsonLd } from './structured-data';
import { getSocialLinkHref } from './branch-helpers';
import type { Branch, BrandSettings } from '@/domain/types';

const LOGO_UPDATED_AT = new Date('2026-10-27T12:00:00.000Z');

const brand: BrandSettings = {
  name: 'Pancheria Popular',
  tagline: null,
  logoUpdatedAt: LOGO_UPDATED_AT,
  legalName: null,
  taxId: null,
  supportEmail: 'hola@pancheria.com',
  termsUrl: null,
  privacyUrl: null,
  footerAbout: null,
  paymentMethods: null,
  developedBy: null,
  showHours: true,
  showMap: true,
  showSocial: true,
  faq: [],
  announcementText: null,
  announcementEnabled: false,
  announcementVariant: 'info',
};

const branch = {
  id: 3,
  name: 'Pancheria Popular Av. Los Minerales',
  address: 'Av. Los Minerales 1234',
  openingHours: [{ dayOfWeek: 1, open: '10:00', close: '22:00' }],
  phones: [{ label: 'Pedidos', number: '3415555555' }],
  socialLinks: [{ network: 'instagram' as const, url: 'https://instagram.com/pancheria' }],
  location: null,
  isActive: true,
  createdAt: new Date(),
} as Branch;

const BASE_URL = 'https://pedidos.ejemplo.com';

describe('buildBranchRestaurantJsonLd', () => {
  test('describe la sucursal con su acción de pedido y el logo absoluto', () => {
    const data = buildBranchRestaurantJsonLd({ baseUrl: BASE_URL, brand, branch });

    expect(data).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'Restaurant',
      name: 'Pancheria Popular Av. Los Minerales',
      url: `${BASE_URL}/pedido?branchId=3`,
      image: `${BASE_URL}/api/public/marca/logo?v=${LOGO_UPDATED_AT.getTime()}`,
      telephone: '3415555555',
      email: 'hola@pancheria.com',
      address: { '@type': 'PostalAddress', streetAddress: 'Av. Los Minerales 1234' },
      openingHoursSpecification: [
        {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: 'Monday',
          opens: '10:00',
          closes: '22:00',
        },
      ],
      potentialAction: {
        '@type': 'OrderAction',
        target: { '@type': 'EntryPoint', urlTemplate: `${BASE_URL}/pedido?branchId=3` },
      },
    });
  });

  test('omite los campos que la sucursal o la marca no tienen', () => {
    const data = buildBranchRestaurantJsonLd({
      baseUrl: BASE_URL,
      brand: { ...brand, logoUpdatedAt: null, supportEmail: null },
      branch: { ...branch, address: null, phones: [], openingHours: [], socialLinks: [] },
    });

    expect(data).not.toHaveProperty('image');
    expect(data).not.toHaveProperty('email');
    expect(data).not.toHaveProperty('telephone');
    expect(data).not.toHaveProperty('address');
    expect(data).not.toHaveProperty('openingHoursSpecification');
    expect(data).not.toHaveProperty('sameAs');
  });

  test('incluye en sameAs solo las redes con enlace válido', () => {
    const expected = getSocialLinkHref(branch.socialLinks[0]);
    const data = buildBranchRestaurantJsonLd({ baseUrl: BASE_URL, brand, branch });

    expect((data as Record<string, unknown>).sameAs).toEqual(
      expected ? [expected] : undefined
    );
  });
});

describe('serializeJsonLd', () => {
  test('escapa "<" para que el contenido no cierre el script que lo contiene', () => {
    const json = serializeJsonLd({ name: '</script><script>alert(1)' });

    expect(json).not.toContain('</script>');
    expect(JSON.parse(json)).toEqual({ name: '</script><script>alert(1)' });
  });
});
