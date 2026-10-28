import { routes } from '@/config/routes';
import { getSocialLinkHref } from '@/lib/branch-helpers';
import { getBrandDisplayName, getBrandLogoPath } from '@/lib/brand-helpers';
import type { Branch, BrandSettings } from '@/domain/types';

const SCHEMA_DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

interface BranchRestaurantJsonLdInput {
  baseUrl: string;
  brand: BrandSettings;
  branch: Branch;
}

export function buildBranchRestaurantJsonLd({
  baseUrl,
  brand,
  branch,
}: BranchRestaurantJsonLdInput) {
  const orderUrl = `${baseUrl}${routes.pedido}?branchId=${branch.id}`;
  const logoPath = getBrandLogoPath(brand.logoUpdatedAt);
  const phone = branch.phones?.[0]?.number;
  const sameAs = (branch.socialLinks ?? []).flatMap((link) => {
    const href = getSocialLinkHref(link);
    return href ? [href] : [];
  });

  return {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: branch.name,
    brand: { '@type': 'Brand', name: getBrandDisplayName(brand, branch.name) },
    url: orderUrl,
    ...(logoPath ? { image: `${baseUrl}${logoPath}` } : {}),
    ...(phone ? { telephone: phone } : {}),
    ...(brand.supportEmail ? { email: brand.supportEmail } : {}),
    ...(branch.address
      ? { address: { '@type': 'PostalAddress', streetAddress: branch.address } }
      : {}),
    ...(branch.openingHours.length > 0
      ? {
          openingHoursSpecification: branch.openingHours.map((hour) => ({
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: SCHEMA_DAY_NAMES[hour.dayOfWeek],
            opens: hour.open,
            closes: hour.close,
          })),
        }
      : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
    potentialAction: {
      '@type': 'OrderAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: orderUrl,
        actionPlatform: [
          'http://schema.org/DesktopWebPlatform',
          'http://schema.org/MobileWebPlatform',
        ],
      },
    },
  };
}

export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
