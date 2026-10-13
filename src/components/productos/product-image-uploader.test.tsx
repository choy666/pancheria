/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { ProductImageUploader } from './product-image-uploader';
import type { ProductImageValue } from '@/lib/product-image-upload-client';
import { formatMoney } from '@/lib/money';

type UploaderProps = ComponentProps<typeof ProductImageUploader>;

const MB = 1024 * 1024;

const guardada: ProductImageValue = {
  source: 'stored',
  imageUrl: 'https://ejemplo.com/gaseosa.webp',
  imageKey: null,
  imageMimeType: null,
  imageSize: null,
};

function archivo(nombre: string, tipo: string, tamaño = 1024): File {
  const file = new File(['contenido'], nombre, { type: tipo });
  Object.defineProperty(file, 'size', { value: tamaño });
  return file;
}

function renderUploader(props: Partial<UploaderProps> = {}) {
  const onChange = jest.fn();
  const onErrorChange = jest.fn();
  render(
    <ProductImageUploader
      value={{ source: 'none' }}
      onChange={onChange}
      error={null}
      onErrorChange={onErrorChange}
      productName="Gaseosa"
      productPrice={1500}
      {...props}
    />
  );
  return { onChange, onErrorChange };
}

function elegirArchivo(file: File | null) {
  fireEvent.change(screen.getByLabelText('Archivo de imagen'), {
    target: { files: file ? [file] : [] },
  });
}

function imagen() {
  return screen.getByAltText('Vista previa de la imagen');
}

describe('ProductImageUploader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.URL.createObjectURL = jest.fn(() => 'blob:nueva');
    global.URL.revokeObjectURL = jest.fn();
  });

  describe('selección de archivo', () => {
    test('un tipo no permitido avisa el error y no quita la imagen guardada', () => {
      const { onChange, onErrorChange } = renderUploader({ value: guardada });
      elegirArchivo(archivo('catalogo.gif', 'image/gif'));

      expect(onChange).not.toHaveBeenCalled();
      expect(onErrorChange).toHaveBeenCalledWith(expect.stringContaining('Tipo no permitido'));
    });

    test('un archivo que supera el tamaño máximo no quita la imagen guardada', () => {
      const { onChange, onErrorChange } = renderUploader({ value: guardada });
      elegirArchivo(archivo('promo1.png', 'image/png', 6 * MB));

      expect(onChange).not.toHaveBeenCalled();
      expect(onErrorChange).toHaveBeenCalledWith(expect.stringContaining('supera el límite'));
    });

    test('cancelar el selector no quita la imagen ni toca el error', () => {
      const { onChange, onErrorChange } = renderUploader({ value: guardada });
      elegirArchivo(null);

      expect(onChange).not.toHaveBeenCalled();
      expect(onErrorChange).not.toHaveBeenCalled();
    });

    test('un archivo válido reemplaza la imagen y limpia el error anterior', () => {
      const { onChange, onErrorChange } = renderUploader({
        value: guardada,
        error: 'Tipo no permitido. Permitidos: image/jpeg.',
      });
      const file = archivo('gaseosa.webp', 'image/webp');
      elegirArchivo(file);

      expect(onErrorChange).toHaveBeenCalledWith(null);
      expect(onChange).toHaveBeenCalledWith({ source: 'upload', file, previewUrl: 'blob:nueva' });
    });
  });

  describe('vista previa', () => {
    test('un archivo pendiente que el navegador no puede mostrar bloquea con error y no lo descarta', () => {
      const pendiente: ProductImageValue = {
        source: 'upload',
        file: archivo('roto.png', 'image/png'),
        previewUrl: 'blob:roto',
      };
      const { onChange, onErrorChange } = renderUploader({ value: pendiente });
      fireEvent.error(imagen());

      expect(onErrorChange).toHaveBeenCalledWith(expect.stringContaining('No se pudo leer el archivo'));
      expect(onChange).not.toHaveBeenCalled();
    });

    test('una imagen guardada que no carga avisa sin quitarla ni bloquear Guardar', () => {
      const { onChange, onErrorChange } = renderUploader({ value: guardada });
      fireEvent.error(imagen());

      expect(screen.getByText(/No se pudo cargar la imagen guardada/)).toBeInTheDocument();
      expect(onChange).not.toHaveBeenCalled();
      expect(onErrorChange).not.toHaveBeenCalled();
    });

    test('avisa si la proporción no es 16:9 sin bloquear Guardar', () => {
      const { onErrorChange } = renderUploader({ value: guardada });
      const img = imagen();
      Object.defineProperty(img, 'naturalWidth', { value: 1200 });
      Object.defineProperty(img, 'naturalHeight', { value: 1200 });
      fireEvent.load(img);

      expect(screen.getByText(/La proporción no es 16:9/)).toBeInTheDocument();
      expect(onErrorChange).not.toHaveBeenCalled();
    });

    test('una imagen 16:9 no muestra aviso de proporción', () => {
      renderUploader({ value: guardada });
      const img = imagen();
      Object.defineProperty(img, 'naturalWidth', { value: 1600 });
      Object.defineProperty(img, 'naturalHeight', { value: 900 });
      fireEvent.load(img);

      expect(screen.queryByText(/La proporción no es 16:9/)).not.toBeInTheDocument();
    });

    test('muestra nombre y precio como en la tarjeta del catálogo', () => {
      renderUploader({ value: guardada });

      expect(screen.getByText('Gaseosa')).toBeInTheDocument();
      expect(screen.getByText(formatMoney(1500))).toBeInTheDocument();
    });

    test('sin imagen muestra el monograma de marca', () => {
      renderUploader();

      expect(screen.getByRole('img', { name: 'Imagen no disponible para Gaseosa' })).toBeInTheDocument();
    });
  });

  describe('error controlado', () => {
    test('Descartar limpia el error sin tocar la imagen', () => {
      const { onChange, onErrorChange } = renderUploader({
        value: guardada,
        error: 'Tipo no permitido.',
      });

      expect(screen.getByRole('alert')).toHaveTextContent('Tipo no permitido.');
      fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));

      expect(onErrorChange).toHaveBeenCalledWith(null);
      expect(onChange).not.toHaveBeenCalled();
    });

    test('Quitar imagen envía none y limpia el error', () => {
      const { onChange, onErrorChange } = renderUploader({
        value: guardada,
        error: 'Tipo no permitido.',
      });
      fireEvent.click(screen.getByRole('button', { name: 'Quitar imagen' }));

      expect(onChange).toHaveBeenCalledWith({ source: 'none' });
      expect(onErrorChange).toHaveBeenCalledWith(null);
    });

    test('no ofrece URLs externas', () => {
      renderUploader();

      expect(screen.queryByRole('button', { name: 'Usar URL' })).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/URL/)).not.toBeInTheDocument();
    });
  });
});
