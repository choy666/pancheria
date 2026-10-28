import Link from 'next/link';
import { getBranchTimezone } from '@/config/branch';
import {
  CONSUMER_DEFENSE_URL,
  PERSONAL_DATA_ACCESS_NOTICE,
  PERSONAL_DATA_AUTHORITY_NOTICE,
  PERSONAL_DATA_AUTHORITY_URL,
} from '@/config/legal';
import { routes } from '@/config/routes';
import {
  formatOpeningHours,
  getSocialLinkHref,
  getSocialNetworkLabel,
  getTodayOpening,
} from '@/lib/branch-helpers';
import { getBrandDisplayName, splitBrandName } from '@/lib/brand-helpers';
import { buildMapViewUrl } from '@/lib/maps';
import type { Branch, BrandSettings } from '@/domain/types';
import { BrandLink } from './brand-link';
import { BrandMark } from './brand-mark';

const LINK_CLASS = 'underline-offset-4 hover:text-white hover:underline';
const HEADING_CLASS = 'font-heading text-base tracking-wide text-white';

interface PublicFooterProps {
  brand: BrandSettings;
  branch?: Branch | null;
  embedded?: boolean;
}

/**
 * Pie de página institucional: identidad, ayuda al pedido, datos de la
 * sucursal, información legal y derechos de autor. Cada bloque se omite si el
 * dueño no cargó sus datos; nunca se muestra un valor inventado.
 */
export function PublicFooter({ brand, branch = null, embedded = false }: PublicFooterProps) {
  const displayName = getBrandDisplayName(brand, branch?.name);
  const legalName = brand.legalName ?? displayName;
  const { first, rest } = splitBrandName(displayName);
  const year = new Intl.DateTimeFormat('es-AR', {
    year: 'numeric',
    timeZone: getBranchTimezone(),
  }).format(new Date());
  const orderHref = branch ? `${routes.pedido}?branchId=${branch.id}` : routes.pedido;
  const mapUrl = brand.showMap && branch?.location ? buildMapViewUrl(branch.location) : null;

  return (
    <footer
      data-testid="public-footer"
      className={
        embedded
          ? 'bg-brand-ink text-sm text-white/80'
          : 'bg-brand-ink text-sm text-white/80 pb-24 lg:pb-0'
      }
    >
      <div className="grid gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <section className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="shrink-0 rounded-lg bg-white p-1">
              <BrandMark name={displayName} logoUpdatedAt={brand.logoUpdatedAt} />
            </span>
            <p className="font-heading text-lg leading-tight text-white">
              <span className="text-brand-mustard">{first}</span>
              {rest && ` ${rest}`}
            </p>
          </div>
          {brand.tagline && <p>{brand.tagline}</p>}
          {brand.footerAbout && <p className="text-white/70">{brand.footerAbout}</p>}
        </section>

        <section className="space-y-3">
          <h2 className={HEADING_CLASS}>Pedidos</h2>
          <ul className="space-y-2">
            <li>
              <Link href={orderHref} className={LINK_CLASS}>
                Hacer pedido
              </Link>
            </li>
            <li>
              <Link href={routes.pedidoSeguimiento} className={LINK_CLASS}>
                Seguir mi pedido y su chat
              </Link>
            </li>
          </ul>
          <ol className="list-decimal space-y-1 pl-5 text-white/70">
            <li>Elegí tus productos.</li>
            <li>Revisá tu pedido.</li>
            <li>Completá tus datos y confirmá.</li>
          </ol>
          {brand.paymentMethods && (
            <p className="text-white/70">Medios de pago: {brand.paymentMethods}</p>
          )}
        </section>

        <section className="space-y-3">
          <h2 className={HEADING_CLASS}>Sucursal</h2>
          {branch?.address && <p className="text-white/70">{branch.address}</p>}
          {branch && (branch.phones ?? []).length > 0 && (
            <ul className="space-y-1 text-white/70">
              {branch.phones.map((phone, index) => (
                <li key={`${phone.label}-${index}`}>
                  {phone.label}: {phone.number}
                </li>
              ))}
            </ul>
          )}
          {brand.showHours && branch && (
            <>
              <p className="text-white/70">{getTodayOpening(branch)}</p>
              {branch.openingHours.length > 0 && (
                <details className="text-white/70">
                  <summary className="cursor-pointer hover:text-white">
                    Ver todos los horarios
                  </summary>
                  <p className="pt-1">{formatOpeningHours([...branch.openingHours])}</p>
                </details>
              )}
            </>
          )}
          {mapUrl && (
            <a href={mapUrl} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
              Ver en el mapa
            </a>
          )}
          {brand.showSocial && branch && (branch.socialLinks ?? []).length > 0 && (
            <ul className="flex flex-wrap gap-x-3 gap-y-1 text-white/70">
              {branch.socialLinks.map((link, index) => {
                const href = getSocialLinkHref(link);
                const label = getSocialNetworkLabel(link.network);
                return (
                  <li key={`${link.network}-${index}`}>
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={LINK_CLASS}
                      >
                        {label}
                      </a>
                    ) : (
                      `${label}: ${link.url}`
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {brand.supportEmail && (
            <p className="text-white/70">
              Atención al cliente:{' '}
              <a href={`mailto:${brand.supportEmail}`} className={LINK_CLASS}>
                {brand.supportEmail}
              </a>
            </p>
          )}
        </section>

        <section className="space-y-3">
          <h2 className={HEADING_CLASS}>Legal</h2>
          <ul className="space-y-2">
            {brand.termsUrl && (
              <li>
                <BrandLink href={brand.termsUrl} className={LINK_CLASS}>
                  Términos y condiciones
                </BrandLink>
              </li>
            )}
            {brand.privacyUrl && (
              <li>
                <BrandLink href={brand.privacyUrl} className={LINK_CLASS}>
                  Política de privacidad
                </BrandLink>
              </li>
            )}
            <li>
              <Link href={routes.pedidoSeguimiento} className={LINK_CLASS}>
                Botón de arrepentimiento
              </Link>
            </li>
            <li>
              <BrandLink href={CONSUMER_DEFENSE_URL} className={LINK_CLASS}>
                Defensa del consumidor
              </BrandLink>
            </li>
          </ul>
          {brand.taxId && (
            <p className="text-white/70">
              {legalName} · CUIT {brand.taxId}
            </p>
          )}
          <p className="text-xs text-white/60">{PERSONAL_DATA_ACCESS_NOTICE}</p>
          <p className="text-xs text-white/60">
            {PERSONAL_DATA_AUTHORITY_NOTICE}{' '}
            <BrandLink href={PERSONAL_DATA_AUTHORITY_URL} className={LINK_CLASS}>
              Más información
            </BrandLink>
          </p>
        </section>

        {brand.faq.length > 0 && (
          <section
            aria-labelledby="footer-faq"
            className="space-y-3 border-t border-white/10 pt-8 sm:col-span-2 lg:col-span-4"
          >
            <h2 id="footer-faq" className={HEADING_CLASS}>
              Preguntas frecuentes
            </h2>
            <div className="grid gap-2 md:grid-cols-2">
              {brand.faq.map((item, index) => (
                <details
                  key={index}
                  className="rounded-lg border border-white/10 p-3 open:bg-white/5"
                >
                  <summary className="cursor-pointer font-medium text-white">
                    {item.question}
                  </summary>
                  <p className="pt-2 text-white/70">{item.answer}</p>
                </details>
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-white/10 px-4 py-4 text-xs text-white/70 sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <p>
          © {year} {legalName}. Todos los derechos reservados.
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link href={routes.login} className="hover:text-white hover:underline">
            Acceso para el personal
          </Link>
          {brand.developedBy && <span>Desarrollado por {brand.developedBy}</span>}
        </div>
      </div>
    </footer>
  );
}
