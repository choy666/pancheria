'use server';

import { revalidatePath } from 'next/cache';
import * as brandService from '@/application/services/brandService';
import { invalidateBrandCache } from '@/lib/server-cache';
import { requireAdmin } from '@/lib/auth';
import { DomainError } from '@/domain/errors';
import { routes } from '@/config/routes';

export type BrandConfigState = { error?: string; success?: string } | null;

const GENERIC_SAVE_ERROR = 'No se pudo guardar. Intentá de nuevo.';

function readBrandForm(formData: FormData) {
  const text = (field: string) => formData.get(field)?.toString() ?? '';
  const questions = formData.getAll('faqQuestion').map(String);
  const answers = formData.getAll('faqAnswer').map(String);

  return {
    name: text('name'),
    tagline: text('tagline'),
    legalName: text('legalName'),
    taxId: text('taxId'),
    supportEmail: text('supportEmail'),
    termsUrl: text('termsUrl'),
    privacyUrl: text('privacyUrl'),
    footerAbout: text('footerAbout'),
    paymentMethods: text('paymentMethods'),
    developedBy: text('developedBy'),
    showHours: formData.get('showHours') === 'on',
    showMap: formData.get('showMap') === 'on',
    showSocial: formData.get('showSocial') === 'on',
    faq: questions
      .map((question, index) => ({
        question: question.trim(),
        answer: (answers[index] ?? '').trim(),
      }))
      .filter((item) => item.question !== '' || item.answer !== ''),
    announcementEnabled: formData.get('announcementEnabled') === 'on',
    announcementText: text('announcementText'),
    announcementVariant: text('announcementVariant'),
  };
}

function revalidateBrand(): void {
  invalidateBrandCache();
  revalidatePath(routes.pedidoConfig);
}

export async function updateBrandSettingsAction(
  _prevState: BrandConfigState,
  formData: FormData
): Promise<BrandConfigState> {
  await requireAdmin();

  try {
    await brandService.updateSettings(readBrandForm(formData));
  } catch (error) {
    if (error instanceof DomainError) {
      return { error: error.message };
    }
    return { error: GENERIC_SAVE_ERROR };
  }

  revalidateBrand();
  return { success: 'Página de pedido guardada.' };
}

export async function updateBrandLogoAction(
  _prevState: BrandConfigState,
  formData: FormData
): Promise<BrandConfigState> {
  await requireAdmin();

  const logo = formData.get('logo');
  if (!(logo instanceof File) || logo.size === 0) {
    return { error: 'Elegí una imagen para el logo.' };
  }

  try {
    await brandService.saveLogo(logo);
  } catch (error) {
    if (error instanceof DomainError) {
      return { error: error.message };
    }
    return { error: GENERIC_SAVE_ERROR };
  }

  revalidateBrand();
  return { success: 'Logo guardado.' };
}

export async function removeBrandLogoAction(): Promise<BrandConfigState> {
  await requireAdmin();

  try {
    await brandService.removeLogo();
  } catch {
    return { error: GENERIC_SAVE_ERROR };
  }

  revalidateBrand();
  return { success: 'Logo quitado.' };
}
