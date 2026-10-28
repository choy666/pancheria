/**
 * @jest-environment node
 */
import * as brandService from './brandService';
import * as brandRepository from '@/repositories/brandRepository';
import { getCachedBrandSettings } from '@/lib/server-cache';
import { ValidationError } from '@/domain/errors';
import type { BrandSettings } from '@/domain/types';

jest.mock('@/repositories/brandRepository', () => ({
  findSettings: jest.fn(),
  findLogo: jest.fn(),
  upsertSettings: jest.fn(),
  upsertLogo: jest.fn(),
  clearLogo: jest.fn(),
}));

jest.mock('@/lib/server-cache', () => ({
  getCachedBrandSettings: jest.fn(),
}));

const mockedRepository = brandRepository as jest.Mocked<typeof brandRepository>;
const mockedGetCachedBrandSettings = getCachedBrandSettings as jest.MockedFunction<
  typeof getCachedBrandSettings
>;

const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0];

const VALID_INPUT = {
  name: 'Pancheria Popular',
  tagline: '',
  legalName: '',
  taxId: '',
  supportEmail: '',
  termsUrl: '',
  privacyUrl: '',
  footerAbout: '',
  paymentMethods: '',
  developedBy: '',
  showHours: true,
  showMap: true,
  showSocial: true,
  faq: [],
  announcementText: '',
  announcementEnabled: false,
  announcementVariant: 'info',
};

function fakeFile(declaredType: string, bytes: number[] = PNG_HEADER, size?: number) {
  const data = new Uint8Array(bytes);
  return {
    type: declaredType,
    size: size ?? data.byteLength,
    arrayBuffer: async () => data.buffer,
  } as unknown as File;
}

describe('brandService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getBrand', () => {
    test('usa valores por defecto cuando todavía no hay fila', async () => {
      mockedGetCachedBrandSettings.mockResolvedValue(null);

      await expect(brandService.getBrand()).resolves.toMatchObject({
        name: null,
        showHours: true,
        showMap: true,
        showSocial: true,
        faq: [],
        announcementEnabled: false,
        announcementVariant: 'info',
      });
    });

    test('devuelve la marca guardada', async () => {
      const saved = { ...VALID_INPUT, logoUpdatedAt: null, faq: [] } as unknown as BrandSettings;
      mockedGetCachedBrandSettings.mockResolvedValue(saved);

      await expect(brandService.getBrand()).resolves.toEqual(saved);
    });
  });

  describe('updateSettings', () => {
    test('guarda los textos vacíos como NULL y el CUIT en formato canónico', async () => {
      await brandService.updateSettings({
        ...VALID_INPUT,
        name: '   ',
        taxId: '30123456789',
        supportEmail: 'hola@pancheria.com',
      });

      expect(mockedRepository.upsertSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          name: null,
          taxId: '30-12345678-9',
          supportEmail: 'hola@pancheria.com',
          termsUrl: null,
          tagline: null,
        })
      );
    });

    test('rechaza un aviso activo sin texto', async () => {
      await expect(
        brandService.updateSettings({ ...VALID_INPUT, announcementEnabled: true })
      ).rejects.toThrow(ValidationError);
      await expect(
        brandService.updateSettings({ ...VALID_INPUT, announcementEnabled: true })
      ).rejects.toThrow('Escribí el texto del aviso o desactivalo.');
      expect(mockedRepository.upsertSettings).not.toHaveBeenCalled();
    });

    test('exige https en los enlaces legales', async () => {
      await expect(
        brandService.updateSettings({
          ...VALID_INPUT,
          termsUrl: 'http://ejemplo.com/terminos',
        })
      ).rejects.toThrow('Usá una URL https://');
    });

    test('limita la ayuda a 8 preguntas y exige respuesta en cada una', async () => {
      const faq = Array.from({ length: 9 }, (_, index) => ({
        question: `Pregunta ${index}`,
        answer: `Respuesta ${index}`,
      }));

      await expect(brandService.updateSettings({ ...VALID_INPUT, faq })).rejects.toThrow(
        'La ayuda admite hasta 8 preguntas.'
      );
      await expect(
        brandService.updateSettings({
          ...VALID_INPUT,
          faq: [{ question: 'Sin respuesta', answer: '   ' }],
        })
      ).rejects.toThrow('Cada respuesta necesita un texto.');
    });
  });

  describe('saveLogo', () => {
    test('guarda un PNG cuya firma coincide con el tipo declarado', async () => {
      await brandService.saveLogo(fakeFile('image/png'));

      expect(mockedRepository.upsertLogo).toHaveBeenCalledWith(
        expect.any(Buffer),
        'image/png'
      );
    });

    test('rechaza tipos fuera de PNG, JPG y WebP', async () => {
      await expect(
        brandService.saveLogo(fakeFile('image/svg+xml'))
      ).rejects.toThrow('El logo debe ser PNG, JPG o WebP.');
      expect(mockedRepository.upsertLogo).not.toHaveBeenCalled();
    });

    test('rechaza archivos que superan el tamaño máximo', async () => {
      await expect(
        brandService.saveLogo(fakeFile('image/png', PNG_HEADER, 600 * 1024))
      ).rejects.toThrow('El logo supera el tamaño máximo de 512 KB.');
      expect(mockedRepository.upsertLogo).not.toHaveBeenCalled();
    });

    test('rechaza contenido que no coincide con el tipo declarado', async () => {
      await expect(brandService.saveLogo(fakeFile('image/jpeg'))).rejects.toThrow(
        'El contenido del archivo no coincide con el tipo declarado.'
      );
      expect(mockedRepository.upsertLogo).not.toHaveBeenCalled();
    });
  });

  test('removeLogo borra el logo guardado', async () => {
    await brandService.removeLogo();

    expect(mockedRepository.clearLogo).toHaveBeenCalledTimes(1);
  });
});
