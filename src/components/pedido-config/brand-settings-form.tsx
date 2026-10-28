'use client';

import { useActionState, useState } from 'react';
import type { ReactNode } from 'react';
import { nanoid } from 'nanoid';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  BRAND_FAQ_ANSWER_MAX_LENGTH,
  BRAND_FAQ_MAX_ITEMS,
  BRAND_FAQ_QUESTION_MAX_LENGTH,
} from '@/config/brand';
import { emptyToNull } from '@/lib/brand-helpers';
import { BrandPreview } from './brand-preview';
import type { BrandConfigState } from '@/app/(panel)/pedido-config/actions';
import type {
  Branch,
  BrandAnnouncementVariant,
  BrandSettings,
} from '@/domain/types';

type FaqRow = { _id: string; question: string; answer: string };

type BrandFormValues = {
  name: string;
  tagline: string;
  legalName: string;
  taxId: string;
  supportEmail: string;
  termsUrl: string;
  privacyUrl: string;
  developedBy: string;
  footerAbout: string;
  paymentMethods: string;
  showHours: boolean;
  showMap: boolean;
  showSocial: boolean;
  announcementEnabled: boolean;
  announcementText: string;
  announcementVariant: BrandAnnouncementVariant;
};

interface BrandSettingsFormProps {
  brand: BrandSettings;
  branch: Branch | null;
  updateAction: (
    _prevState: BrandConfigState,
    formData: FormData
  ) => Promise<BrandConfigState>;
}

const initialState: BrandConfigState = null;

const VARIANT_OPTIONS: { value: BrandAnnouncementVariant; label: string }[] = [
  { value: 'info', label: 'Informativo' },
  { value: 'warning', label: 'Advertencia' },
];

function toFormValues(brand: BrandSettings): BrandFormValues {
  return {
    name: brand.name ?? '',
    tagline: brand.tagline ?? '',
    legalName: brand.legalName ?? '',
    taxId: brand.taxId ?? '',
    supportEmail: brand.supportEmail ?? '',
    termsUrl: brand.termsUrl ?? '',
    privacyUrl: brand.privacyUrl ?? '',
    developedBy: brand.developedBy ?? '',
    footerAbout: brand.footerAbout ?? '',
    paymentMethods: brand.paymentMethods ?? '',
    showHours: brand.showHours,
    showMap: brand.showMap,
    showSocial: brand.showSocial,
    announcementEnabled: brand.announcementEnabled,
    announcementText: brand.announcementText ?? '',
    announcementVariant: brand.announcementVariant,
  };
}

function createFaqRow(question = '', answer = ''): FaqRow {
  return { _id: `faq-${nanoid()}`, question, answer };
}

function Field({
  id,
  label,
  help,
  children,
}: {
  id: string;
  label: string;
  help?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  );
}

function CheckOption({
  name,
  label,
  description,
  checked,
  onChange,
}: {
  name: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 font-normal">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 accent-primary"
      />
      <span>
        <span className="block font-medium">{label}</span>
        <span className="block text-sm text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}

/**
 * Formulario de la página de pedido. Los valores viven en estado local para
 * que la vista previa refleje los cambios antes de guardar; el servidor valida
 * y normaliza todo al guardar (fuente de verdad).
 */
export function BrandSettingsForm({
  brand,
  branch,
  updateAction,
}: BrandSettingsFormProps) {
  const [state, formAction, isPending] = useActionState(updateAction, initialState);
  const [values, setValues] = useState<BrandFormValues>(() => toFormValues(brand));
  const [faqRows, setFaqRows] = useState<FaqRow[]>(() =>
    brand.faq.map((item) => createFaqRow(item.question, item.answer))
  );

  function setField<K extends keyof BrandFormValues>(key: K, value: BrandFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function addFaqRow() {
    setFaqRows((prev) => [...prev, createFaqRow()]);
  }

  function removeFaqRow(id: string) {
    setFaqRows((prev) => prev.filter((row) => row._id !== id));
  }

  function updateFaqRow(id: string, field: 'question' | 'answer', value: string) {
    setFaqRows((prev) =>
      prev.map((row) => (row._id === id ? { ...row, [field]: value } : row))
    );
  }

  const previewBrand: BrandSettings = {
    ...brand,
    name: emptyToNull(values.name),
    tagline: emptyToNull(values.tagline),
    legalName: emptyToNull(values.legalName),
    taxId: emptyToNull(values.taxId),
    supportEmail: emptyToNull(values.supportEmail),
    termsUrl: emptyToNull(values.termsUrl),
    privacyUrl: emptyToNull(values.privacyUrl),
    footerAbout: emptyToNull(values.footerAbout),
    paymentMethods: emptyToNull(values.paymentMethods),
    developedBy: emptyToNull(values.developedBy),
    showHours: values.showHours,
    showMap: values.showMap,
    showSocial: values.showSocial,
    faq: faqRows.flatMap((row) =>
      row.question.trim() && row.answer.trim()
        ? [{ question: row.question.trim(), answer: row.answer.trim() }]
        : []
    ),
    announcementEnabled: values.announcementEnabled,
    announcementText: emptyToNull(values.announcementText),
    announcementVariant: values.announcementVariant,
  };

  return (
    <div className="grid gap-8 xl:grid-cols-2 xl:items-start">
      <form action={formAction} data-testid="brand-settings-form" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Marca</CardTitle>
            <CardDescription>
              Nombre y lema que ven los clientes. Si dejás el nombre vacío, se usa
              el de la sucursal activa.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field id="brand-name" label="Nombre comercial" help="Por ejemplo: Pancheria Popular.">
              <Input
                id="brand-name"
                name="name"
                value={values.name}
                maxLength={120}
                onChange={(event) => setField('name', event.target.value)}
                data-testid="brand-name"
              />
            </Field>
            <Field
              id="brand-tagline"
              label="Lema (opcional)"
              help="Una frase corta para el encabezado, el pie y los enlaces compartidos."
            >
              <Input
                id="brand-tagline"
                name="tagline"
                value={values.tagline}
                maxLength={160}
                onChange={(event) => setField('tagline', event.target.value)}
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Datos legales y contacto</CardTitle>
            <CardDescription>
              Se muestran en el pie de página. Sin razón social ni CUIT, el pie
              usa el nombre comercial en el derecho de autor.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field id="brand-legal-name" label="Razón social (opcional)">
              <Input
                id="brand-legal-name"
                name="legalName"
                value={values.legalName}
                maxLength={255}
                onChange={(event) => setField('legalName', event.target.value)}
              />
            </Field>
            <Field id="brand-tax-id" label="CUIT (opcional)" help="Con o sin guiones: 11 dígitos.">
              <Input
                id="brand-tax-id"
                name="taxId"
                inputMode="numeric"
                placeholder="30-12345678-9"
                value={values.taxId}
                onChange={(event) => setField('taxId', event.target.value)}
              />
            </Field>
            <Field
              id="brand-support-email"
              label="Correo de atención al cliente (opcional)"
            >
              <Input
                id="brand-support-email"
                name="supportEmail"
                type="email"
                maxLength={255}
                value={values.supportEmail}
                onChange={(event) => setField('supportEmail', event.target.value)}
              />
            </Field>
            <Field
              id="brand-developed-by"
              label="Desarrollado por (opcional)"
              help="Crédito en la barra inferior del pie."
            >
              <Input
                id="brand-developed-by"
                name="developedBy"
                maxLength={120}
                value={values.developedBy}
                onChange={(event) => setField('developedBy', event.target.value)}
              />
            </Field>
            <Field
              id="brand-terms-url"
              label="Términos y condiciones (opcional)"
              help="Un enlace https:// o una ruta interna que empiece con /."
            >
              <Input
                id="brand-terms-url"
                name="termsUrl"
                placeholder="https://"
                value={values.termsUrl}
                onChange={(event) => setField('termsUrl', event.target.value)}
              />
            </Field>
            <Field id="brand-privacy-url" label="Política de privacidad (opcional)">
              <Input
                id="brand-privacy-url"
                name="privacyUrl"
                placeholder="https://"
                value={values.privacyUrl}
                onChange={(event) => setField('privacyUrl', event.target.value)}
              />
            </Field>
            {(!values.supportEmail.trim() || !values.termsUrl.trim() || !values.privacyUrl.trim()) && (
              <p className="text-sm text-amber-700 sm:col-span-2" data-testid="brand-legal-hint">
                Recomendado: cargá el correo de atención, los términos y la política de privacidad. Sin ellos el pie queda incompleto para el cliente.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pie de página</CardTitle>
            <CardDescription>
              Qué bloques mostrar. Los horarios, el mapa y las redes salen de la
              sucursal activa.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field id="brand-footer-about" label="Descripción del negocio (opcional)">
              <Textarea
                id="brand-footer-about"
                name="footerAbout"
                maxLength={400}
                value={values.footerAbout}
                onChange={(event) => setField('footerAbout', event.target.value)}
              />
            </Field>
            <Field
              id="brand-payment-methods"
              label="Medios de pago (opcional)"
              help="Por ejemplo: efectivo, transferencia y Mercado Pago."
            >
              <Input
                id="brand-payment-methods"
                name="paymentMethods"
                maxLength={200}
                value={values.paymentMethods}
                onChange={(event) => setField('paymentMethods', event.target.value)}
              />
            </Field>
            <CheckOption
              name="showHours"
              label="Horarios"
              description="Horario de hoy y la lista completa de la sucursal."
              checked={values.showHours}
              onChange={(checked) => setField('showHours', checked)}
            />
            <CheckOption
              name="showMap"
              label="Mapa"
              description="Enlace a la ubicación de la sucursal."
              checked={values.showMap}
              onChange={(checked) => setField('showMap', checked)}
            />
            <CheckOption
              name="showSocial"
              label="Redes sociales"
              description="Enlaces a las redes de la sucursal."
              checked={values.showSocial}
              onChange={(checked) => setField('showSocial', checked)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preguntas frecuentes</CardTitle>
            <CardDescription>
              Hasta {BRAND_FAQ_MAX_ITEMS} preguntas que responden las dudas más
              comunes. Aparecen en el pie de página.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {faqRows.map((row, index) => (
              <div key={row._id} className="space-y-2 rounded-xl border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={`faq-question-${index}`}>Pregunta {index + 1}</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Quitar la pregunta ${index + 1}`}
                    onClick={() => removeFaqRow(row._id)}
                    className="size-8 text-destructive"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
                <Input
                  id={`faq-question-${index}`}
                  name="faqQuestion"
                  maxLength={BRAND_FAQ_QUESTION_MAX_LENGTH}
                  placeholder="¿Cuánto tarda mi pedido?"
                  value={row.question}
                  onChange={(event) => updateFaqRow(row._id, 'question', event.target.value)}
                />
                <Textarea
                  id={`faq-answer-${index}`}
                  name="faqAnswer"
                  maxLength={BRAND_FAQ_ANSWER_MAX_LENGTH}
                  aria-label={`Respuesta a la pregunta ${index + 1}`}
                  placeholder="La respuesta que verá el cliente"
                  value={row.answer}
                  onChange={(event) => updateFaqRow(row._id, 'answer', event.target.value)}
                />
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addFaqRow}
              disabled={faqRows.length >= BRAND_FAQ_MAX_ITEMS}
              data-testid="brand-faq-add"
            >
              <Plus className="mr-1 size-4" aria-hidden="true" />
              Agregar pregunta
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Aviso destacado</CardTitle>
            <CardDescription>
              Un mensaje arriba del catálogo, por ejemplo un horario especial o un
              feriado.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <CheckOption
              name="announcementEnabled"
              label="Mostrar el aviso"
              description="Solo se muestra si tiene texto."
              checked={values.announcementEnabled}
              onChange={(checked) => setField('announcementEnabled', checked)}
            />
            <Field id="brand-announcement-text" label="Texto del aviso">
              <Textarea
                id="brand-announcement-text"
                name="announcementText"
                maxLength={280}
                value={values.announcementText}
                onChange={(event) => setField('announcementText', event.target.value)}
              />
            </Field>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Estilo</legend>
              <div className="flex flex-wrap gap-4">
                {VARIANT_OPTIONS.map((option) => (
                  <label key={option.value} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="announcementVariant"
                      value={option.value}
                      checked={values.announcementVariant === option.value}
                      onChange={() => setField('announcementVariant', option.value)}
                      className="accent-primary"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>
          </CardContent>
        </Card>

        {state?.error && (
          <p role="alert" className="text-sm text-destructive" data-testid="brand-settings-error">
            {state.error}
          </p>
        )}
        {state?.success && (
          <p role="status" className="text-sm text-green-600" data-testid="brand-settings-success">
            {state.success}
          </p>
        )}

        <CardFooter className="px-0">
          <Button
            type="submit"
            disabled={isPending}
            data-testid="brand-settings-save"
            className="w-full sm:w-auto"
          >
            {isPending ? 'Guardando...' : 'Guardar página de pedido'}
          </Button>
        </CardFooter>
      </form>

      <div className="xl:sticky xl:top-20">
        <BrandPreview brand={previewBrand} branch={branch} />
      </div>
    </div>
  );
}
