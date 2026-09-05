/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { VideoPlayer } from './video-player';

describe('VideoPlayer', () => {
  test('renderiza el reproductor con la URL y el tipo MIME explícito', () => {
    const { container } = render(
      <VideoPlayer src="https://example.com/video.mp4" mimeType="video/mp4" />
    );

    const video = container.querySelector('video');
    expect(video).toBeInTheDocument();

    const source = container.querySelector('video source');
    expect(source).toBeInTheDocument();
    expect(source).toHaveAttribute('src', 'https://example.com/video.mp4');
    expect(source).toHaveAttribute('type', 'video/mp4');
  });

  test('adivina el tipo MIME a partir de la extensión .webm', () => {
    const { container } = render(
      <VideoPlayer src="https://example.com/video.webm" />
    );

    const source = container.querySelector('video source');
    expect(source).toHaveAttribute('type', 'video/webm');
  });

  test('adivina el tipo MIME a partir de la extensión .ogg', () => {
    const { container } = render(
      <VideoPlayer src="https://example.com/video.ogg" />
    );

    const source = container.querySelector('video source');
    expect(source).toHaveAttribute('type', 'video/ogg');
  });

  test('adivina el tipo MIME a partir de la extensión .ogv', () => {
    const { container } = render(
      <VideoPlayer src="https://example.com/video.ogv" />
    );

    const source = container.querySelector('video source');
    expect(source).toHaveAttribute('type', 'video/ogg');
  });

  test('usa video/mp4 por defecto cuando no hay extensión reconocida', () => {
    const { container } = render(
      <VideoPlayer src="https://example.com/stream" />
    );

    const source = container.querySelector('video source');
    expect(source).toHaveAttribute('type', 'video/mp4');
  });

  test('prioriza mimeType prop sobre la extensión', () => {
    const { container } = render(
      <VideoPlayer src="https://example.com/video.webm" mimeType="video/mp4" />
    );

    const source = container.querySelector('video source');
    expect(source).toHaveAttribute('type', 'video/mp4');
  });

  test('muestra el mensaje de fallback del navegador', () => {
    render(<VideoPlayer src="https://example.com/video.mp4" />);

    expect(
      screen.getByText('Tu navegador no soporta la reproducción de videos.')
    ).toBeInTheDocument();
  });

  test('muestra un mensaje de error cuando el video falla', () => {
    const { container } = render(
      <VideoPlayer src="https://example.com/broken.mp4" />
    );

    const video = container.querySelector('video');
    expect(video).toBeInTheDocument();

    if (video) {
      fireEvent.error(video);
    }

    expect(screen.getByRole('alert')).toHaveTextContent(
      'No se pudo reproducir el video. Verificá la URL o el formato.'
    );
  });
});
