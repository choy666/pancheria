/**
 * @jest-environment jsdom
 */
import { render, screen, act, renderHook } from '@testing-library/react';
import { useTour, TourButton, TourProvider } from './tour-context';
import { driver } from 'driver.js';
import type { Config, Driver, DriveStep, DriverHook } from 'driver.js';

jest.mock('driver.js');

const useRouterMock = jest.fn();
const usePathnameMock = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => useRouterMock(),
  usePathname: () => usePathnameMock(),
}));

type MockDriver = {
  isActive: jest.Mock<boolean>;
  drive: jest.Mock;
  destroy: jest.Mock;
  moveNext: jest.Mock;
  movePrevious: jest.Mock;
};

function createMockDriver(): MockDriver {
  const instance: MockDriver = {
    isActive: jest.fn().mockReturnValue(false),
    drive: jest.fn(),
    destroy: jest.fn(),
    moveNext: jest.fn(),
    movePrevious: jest.fn(),
  };
  (driver as unknown as jest.Mock).mockReturnValue(instance);
  return instance;
}

function getLastDriverConfig(): Config {
  const calls = (driver as unknown as jest.Mock).mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1][0] as Config;
}

function lastConfigSteps(): DriveStep[] {
  const steps = getLastDriverConfig().steps;
  expect(steps).toBeDefined();
  return steps as DriveStep[];
}

function createHookOpts(mockDriver: MockDriver): Parameters<NonNullable<DriverHook>>[2] {
  return {
    driver: mockDriver as unknown as Driver,
    config: getLastDriverConfig(),
    state: {},
    index: 0,
  } as Parameters<NonNullable<DriverHook>>[2];
}

describe('TourProvider y TourButton', () => {
  let routerPush: jest.Mock;

  beforeEach(() => {
    routerPush = jest.fn();
    useRouterMock.mockReturnValue({ push: routerPush });
    usePathnameMock.mockReturnValue('/');
    (driver as unknown as jest.Mock).mockClear();
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    jest.clearAllMocks();
  });

  test('no inicia el tour automáticamente al montar', () => {
    render(
      <TourProvider role="admin">
        <div data-testid="child" />
      </TourProvider>
    );

    expect(driver).not.toHaveBeenCalled();
  });

  test('el botón Guía inicia el tour desde el inicio sin navegar', () => {
    const mockDriver = createMockDriver();

    render(
      <TourProvider role="admin">
        <TourButton />
      </TourProvider>
    );

    const button = screen.getByRole('button', { name: 'Guía' });

    act(() => {
      button.click();
    });

    expect(driver).toHaveBeenCalledTimes(1);
    expect(mockDriver.drive).toHaveBeenCalledWith(0);
    expect(routerPush).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('pancheria-tour-step')).toBe('0');
    expect(window.localStorage.getItem('pancheria-tour-active')).toBe('true');
  });

  test('el botón Cerrar guía detiene el tour y limpia el estado', () => {
    createMockDriver();

    render(
      <TourProvider role="admin">
        <TourButton />
      </TourProvider>
    );

    act(() => {
      screen.getByRole('button', { name: 'Guía' }).click();
    });

    const closeButton = screen.getByRole('button', { name: 'Cerrar guía' });

    act(() => {
      closeButton.click();
    });

    expect(window.localStorage.getItem('pancheria-tour-step')).toBeNull();
    expect(window.localStorage.getItem('pancheria-tour-active')).toBeNull();
    expect(window.localStorage.getItem('pancheria-tour-seen')).toBe('true');
  });

  test('onDoneClick del paso final destruye el driver', () => {
    const mockDriver = createMockDriver();

    render(
      <TourProvider role="admin">
        <TourButton />
      </TourProvider>
    );

    act(() => {
      screen.getByRole('button', { name: 'Guía' }).click();
    });

    const config = getLastDriverConfig();
    const finalStep = config.steps![config.steps!.length - 1];

    const opts = createHookOpts(mockDriver);

    (config.onDoneClick)?.(
      undefined,
      finalStep,
      opts
    );

    expect(mockDriver.destroy).toHaveBeenCalled();
  });

  test('onCloseClick destruye el driver en cualquier paso', () => {
    const mockDriver = createMockDriver();

    render(
      <TourProvider role="admin">
        <TourButton />
      </TourProvider>
    );

    act(() => {
      screen.getByRole('button', { name: 'Guía' }).click();
    });

    const config = getLastDriverConfig();
    const steps = config.steps!;
    const opts = createHookOpts(mockDriver);

    (config.onCloseClick)?.(
      undefined,
      steps[0],
      opts
    );

    expect(mockDriver.destroy).toHaveBeenCalled();
  });

  test('retoma el tour desde el paso guardado cuando está activo', () => {
    window.localStorage.setItem('pancheria-tour-active', 'true');
    window.localStorage.setItem('pancheria-tour-step', '4');
    usePathnameMock.mockReturnValue('/ventas');

    const mockDriver = createMockDriver();

    render(
      <TourProvider role="admin">
        <TourButton />
      </TourProvider>
    );

    expect(driver).toHaveBeenCalledTimes(1);
    expect(mockDriver.drive).toHaveBeenCalledWith(4);
    expect(window.localStorage.getItem('pancheria-tour-step')).toBeNull();
  });

  test('no retoma el tour si no está activo, aunque haya un paso guardado', () => {
    window.localStorage.setItem('pancheria-tour-step', '4');
    usePathnameMock.mockReturnValue('/ventas');

    createMockDriver();

    render(
      <TourProvider role="admin">
        <TourButton />
      </TourProvider>
    );

    expect(driver).not.toHaveBeenCalled();
  });

  test('el onNextClick global avanza al siguiente paso en pasos sin handler propio', () => {
    const mockDriver = createMockDriver();

    render(
      <TourProvider role="admin">
        <TourButton />
      </TourProvider>
    );

    act(() => {
      screen.getByRole('button', { name: 'Guía' }).click();
    });

    const config = getLastDriverConfig();
    const steps = config.steps!;
    const opts = createHookOpts(mockDriver);

    (config.onNextClick)?.(
      undefined,
      steps[1],
      opts
    );

    expect(mockDriver.moveNext).toHaveBeenCalled();
  });

  test('el onPrevClick global retrocede al paso anterior en pasos sin handler propio', () => {
    const mockDriver = createMockDriver();

    render(
      <TourProvider role="admin">
        <TourButton />
      </TourProvider>
    );

    act(() => {
      screen.getByRole('button', { name: 'Guía' }).click();
    });

    const config = getLastDriverConfig();
    const steps = config.steps!;
    const opts = createHookOpts(mockDriver);

    (config.onPrevClick)?.(
      undefined,
      steps[2],
      opts
    );

    expect(mockDriver.movePrevious).toHaveBeenCalled();
  });

  test('el paso de Ventas navega a /ventas y guarda el siguiente paso', () => {
    const mockDriver = createMockDriver();

    render(
      <TourProvider role="admin">
        <TourButton />
      </TourProvider>
    );

    act(() => {
      screen.getByRole('button', { name: 'Guía' }).click();
    });

    const steps = lastConfigSteps();
    const ventasStep = steps.find(
      (s) => s.popover?.title === 'Ventas'
    ) as DriveStep;

    act(() => {
      ventasStep.popover?.onNextClick?.(
        undefined,
        ventasStep,
        createHookOpts(mockDriver)
      );
    });

    expect(routerPush).toHaveBeenCalledWith('/ventas');
    expect(window.localStorage.getItem('pancheria-tour-step')).toBe('5');
    expect(window.localStorage.getItem('pancheria-tour-active')).toBe('true');
    expect(mockDriver.destroy).toHaveBeenCalled();
  });

  test('useTour expone startTour, restartTour, stopTour e isActive', () => {
    createMockDriver();

    const { result } = renderHook(() => useTour(), {
      wrapper: ({ children }) => <TourProvider role="admin">{children}</TourProvider>,
    });

    expect(typeof result.current.startTour).toBe('function');
    expect(typeof result.current.restartTour).toBe('function');
    expect(typeof result.current.stopTour).toBe('function');
    expect(result.current.isActive).toBe(false);
  });

  test('el botón Guía reinicia el tour desde /productos navegando al inicio', () => {
    usePathnameMock.mockReturnValue('/productos');
    createMockDriver();

    render(
      <TourProvider role="admin">
        <TourButton />
      </TourProvider>
    );

    act(() => {
      screen.getByRole('button', { name: 'Guía' }).click();
    });

    expect(window.localStorage.getItem('pancheria-tour-step')).toBe('0');
    expect(window.localStorage.getItem('pancheria-tour-active')).toBe('true');
    expect(routerPush).toHaveBeenCalledWith('/');
    expect(driver).not.toHaveBeenCalled();
  });

  test('el flujo admin incluye productos, sucursales y usuarios', () => {
    const mockDriver = createMockDriver();

    render(
      <TourProvider role="admin">
        <TourButton />
      </TourProvider>
    );

    act(() => {
      screen.getByRole('button', { name: 'Guía' }).click();
    });

    const steps = lastConfigSteps();
    const titles = steps
      .map((s) => s.popover?.title)
      .filter((t): t is string => typeof t === 'string');

    expect(titles).toContain('Productos y promos');
    expect(titles).toContain('Sucursales');
    expect(titles).toContain('Usuarios');

    const navUrls: string[] = [];
    steps.forEach((step) => {
      const onNext = step.popover?.onNextClick;
      if (onNext) {
        routerPush.mockClear();
        act(() => {
          onNext(undefined, step, createHookOpts(mockDriver));
        });
        if (routerPush.mock.calls.length > 0) {
          navUrls.push(String(routerPush.mock.calls[0][0]));
        }
      }
    });

    expect(navUrls).toContain('/productos');
    expect(navUrls).toContain('/sucursales');
    expect(navUrls).toContain('/usuarios');
  });

  test('el flujo operator no incluye productos, sucursales ni usuarios', () => {
    const mockDriver = createMockDriver();

    render(
      <TourProvider role="operator">
        <TourButton />
      </TourProvider>
    );

    act(() => {
      screen.getByRole('button', { name: 'Guía' }).click();
    });

    const steps = lastConfigSteps();
    const titles = steps
      .map((s) => s.popover?.title)
      .filter((t): t is string => typeof t === 'string');

    expect(titles).not.toContain('Productos y promos');
    expect(titles).not.toContain('Sucursales');
    expect(titles).not.toContain('Usuarios');

    const navUrls: string[] = [];
    steps.forEach((step) => {
      const onNext = step.popover?.onNextClick;
      if (onNext) {
        routerPush.mockClear();
        act(() => {
          onNext(undefined, step, createHookOpts(mockDriver));
        });
        if (routerPush.mock.calls.length > 0) {
          navUrls.push(String(routerPush.mock.calls[0][0]));
        }
      }
    });

    expect(navUrls).not.toContain('/productos');
    expect(navUrls).not.toContain('/sucursales');
    expect(navUrls).not.toContain('/usuarios');
  });

  test('restartTour con role="operator" desde / inicia el recorrido correcto', () => {
    usePathnameMock.mockReturnValue('/');
    const mockDriver = createMockDriver();

    render(
      <TourProvider role="operator">
        <TourButton />
      </TourProvider>
    );

    act(() => {
      screen.getByRole('button', { name: 'Guía' }).click();
    });

    expect(driver).toHaveBeenCalledTimes(1);
    expect(mockDriver.drive).toHaveBeenCalledWith(0);
    expect(routerPush).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('pancheria-tour-step')).toBe('0');
    expect(window.localStorage.getItem('pancheria-tour-active')).toBe('true');
  });

  test('TourButton llama onBeforeToggle antes de iniciar y detener el tour', () => {
    const onBeforeToggle = jest.fn();
    createMockDriver();

    render(
      <TourProvider role="admin">
        <TourButton onBeforeToggle={onBeforeToggle} />
      </TourProvider>
    );

    act(() => {
      screen.getByRole('button', { name: 'Guía' }).click();
    });

    expect(onBeforeToggle).toHaveBeenCalledTimes(1);

    onBeforeToggle.mockClear();

    act(() => {
      screen.getByRole('button', { name: 'Cerrar guía' }).click();
    });

    expect(onBeforeToggle).toHaveBeenCalledTimes(1);
  });

  test('startTour no crea un driver duplicado si el tour ya está activo', () => {
    const mockDriver = createMockDriver();

    const { result } = renderHook(() => useTour(), {
      wrapper: ({ children }) => (
        <TourProvider role="admin">{children}</TourProvider>
      ),
    });

    act(() => {
      result.current.startTour();
    });

    expect(driver).toHaveBeenCalledTimes(1);

    mockDriver.isActive.mockReturnValue(true);

    act(() => {
      result.current.startTour();
    });

    expect(driver).toHaveBeenCalledTimes(1);
  });

});
