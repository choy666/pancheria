import {
  getSocialLinkHref,
  getSocialNetworkLabel,
} from '@/lib/branch-helpers';
import type { BranchPhone, BranchSocialLink } from '@/domain/types';

interface BranchPhonesProps {
  phones: BranchPhone[];
  className?: string;
  /** Clase extra para el número (p. ej. `font-mono` en el resumen del pedido). */
  numberClassName?: string;
}

/**
 * Teléfonos de la sucursal como líneas "Etiqueta: número". Bloque compartido
 * del catálogo (`BranchInfoCard`), la confirmación del pedido y el chat
 * público: el primer teléfono lleva `data-testid="branch-phone"` (E2E).
 */
export function BranchPhones({
  phones,
  className,
  numberClassName,
}: BranchPhonesProps) {
  return (
    <>
      {phones.map((phone, index) => (
        <p
          key={`${phone.label}-${index}`}
          data-testid={index === 0 ? 'branch-phone' : undefined}
          className={className}
        >
          {phone.label}:{' '}
          {numberClassName ? (
            <span className={numberClassName}>{phone.number}</span>
          ) : (
            phone.number
          )}
        </p>
      ))}
    </>
  );
}

interface BranchSocialLinksProps {
  links: BranchSocialLink[];
  /**
   * `true` para mostrar WhatsApp como texto plano. En el encabezado del
   * catálogo WhatsApp es un dato informativo: el canal de coordinación del
   * pedido es el chat propio.
   */
  whatsappAsText?: boolean;
  className?: string;
}

/**
 * Redes sociales de la sucursal separadas por "·": enlace cuando el valor
 * resuelve a una URL (`getSocialLinkHref`), texto "Red: valor" si es un
 * handle. Compartido por catálogo, confirmación del pedido y chat público.
 */
export function BranchSocialLinks({
  links,
  whatsappAsText = false,
  className,
}: BranchSocialLinksProps) {
  if (links.length === 0) return null;

  return (
    <p data-testid="branch-social-links" className={className}>
      {links.map((link, index) => {
        const href =
          whatsappAsText && link.network === 'whatsapp'
            ? null
            : getSocialLinkHref(link);
        const label = getSocialNetworkLabel(link.network);
        return (
          <span key={`${link.network}-${index}`}>
            {index > 0 && ' · '}
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {label}
              </a>
            ) : (
              `${label}: ${link.url}`
            )}
          </span>
        );
      })}
    </p>
  );
}
