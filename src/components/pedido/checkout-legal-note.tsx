import { BrandLink } from '@/components/publico/brand-link';

interface CheckoutLegalNoteProps {
  termsUrl: string | null;
  privacyUrl: string | null;
}

const LINK_CLASS = 'text-primary underline-offset-2 hover:underline';

/**
 * Aceptación implícita al confirmar: solo enlaza los documentos que el dueño
 * cargó. Sin ninguno no se muestra la nota.
 */
export function CheckoutLegalNote({ termsUrl, privacyUrl }: CheckoutLegalNoteProps) {
  if (!termsUrl && !privacyUrl) return null;

  const termsLink = termsUrl && (
    <BrandLink href={termsUrl} className={LINK_CLASS}>
      Términos y condiciones
    </BrandLink>
  );
  const privacyLink = privacyUrl && (
    <BrandLink href={privacyUrl} className={LINK_CLASS}>
      Política de privacidad
    </BrandLink>
  );

  return (
    <p className="text-xs text-muted-foreground" data-testid="checkout-legal-note">
      Al confirmar aceptás {termsLink ? 'los ' : 'la '}
      {termsLink}
      {termsLink && privacyLink ? ' y la ' : ''}
      {privacyLink}. Usamos tus datos para gestionar tu pedido y coordinarlo con
      la sucursal.
    </p>
  );
}
