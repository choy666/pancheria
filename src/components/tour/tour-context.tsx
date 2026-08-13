'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { driver } from 'driver.js';
import type { DriveStep, Driver } from 'driver.js';
import { Button } from '@/components/ui/button';
import { routes } from '@/config/routes';
import { HelpCircle, X } from 'lucide-react';

interface TourStorage {
  step: string;
  seen: string;
  active: string;
}

function buildTourKeys(
  userId?: string | number,
  branchId?: number
): TourStorage {
  const scope = userId || branchId ? `-${userId ?? 'anon'}-${branchId ?? 'none'}` : '';

  return {
    step: `pancheria-tour-step${scope}`,
    seen: `pancheria-tour-seen${scope}`,
    active: `pancheria-tour-active${scope}`,
  };
}

interface TourContextValue {
  startTour: () => void;
  restartTour: () => void;
  stopTour: () => void;
  isActive: boolean;
}

const TourContext = createContext<TourContextValue | null>(null);

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) {
    throw new Error('useTour debe usarse dentro de un TourProvider');
  }
  return ctx;
}

interface TourButtonProps {
  className?: string;
}

export function TourButton({ className }: TourButtonProps) {
  const { restartTour, stopTour, isActive } = useTour();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => (isActive ? stopTour() : restartTour())}
      className={className}
    >
      {isActive ? (
        <X className="mr-1.5 h-4 w-4" />
      ) : (
        <HelpCircle className="mr-1.5 h-4 w-4" />
      )}
      {isActive ? 'Cerrar guía' : 'Guía'}
    </Button>
  );
}

function isLocalStorageAvailable() {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

function getSavedStep(keys: TourStorage): number | null {
  if (!isLocalStorageAvailable()) return null;
  const raw = window.localStorage.getItem(keys.step);
  if (raw === null) return null;
  const step = Number(raw);
  return Number.isFinite(step) && step >= 0 ? step : null;
}

function saveStep(keys: TourStorage, step: number) {
  if (isLocalStorageAvailable()) {
    window.localStorage.setItem(keys.step, String(step));
  }
}

function clearStep(keys: TourStorage) {
  if (isLocalStorageAvailable()) {
    window.localStorage.removeItem(keys.step);
  }
}

function getTourActive(keys: TourStorage): boolean {
  if (!isLocalStorageAvailable()) return false;
  return window.localStorage.getItem(keys.active) === 'true';
}

function setTourActive(keys: TourStorage) {
  if (isLocalStorageAvailable()) {
    window.localStorage.setItem(keys.active, 'true');
  }
}

function clearTourActive(keys: TourStorage) {
  if (isLocalStorageAvailable()) {
    window.localStorage.removeItem(keys.active);
  }
}

function markTourSeen(keys: TourStorage) {
  if (isLocalStorageAvailable()) {
    window.localStorage.setItem(keys.seen, 'true');
  }
}

interface TourProviderProps {
  children: ReactNode;
  userId?: string | number;
  branchId?: number;
}

export function TourProvider({
  children,
  userId,
  branchId,
}: TourProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const driverRef = useRef<Driver | null>(null);
  const isNavigatingRef = useRef(false);
  const [isActive, setIsActive] = useState(false);
  const keys = useMemo(() => buildTourKeys(userId, branchId), [userId, branchId]);

  const stopTour = useCallback(() => {
    isNavigatingRef.current = false;
    clearStep(keys);
    clearTourActive(keys);
    markTourSeen(keys);
    setIsActive(false);
    driverRef.current?.destroy();
    driverRef.current = null;
  }, [keys]);

  const navigateAndContinue = useCallback(
    (url: string, nextStep: number) => {
      isNavigatingRef.current = true;
      saveStep(keys, nextStep);
      setTourActive(keys);
      driverRef.current?.destroy();
      driverRef.current = null;
      router.push(url);
    },
    [keys, router]
  );

  const goBackAndContinue = useCallback(
    (url: string, prevStep: number) => {
      isNavigatingRef.current = true;
      saveStep(keys, prevStep);
      setTourActive(keys);
      driverRef.current?.destroy();
      driverRef.current = null;
      router.push(url);
    },
    [keys, router]
  );

  const buildSteps = useCallback((): DriveStep[] => {
    const nextOn =
      (url: string, nextStep: number) =>
      () => {
        navigateAndContinue(url, nextStep);
      };

    const prevOn =
      (url: string, prevStep: number) =>
      () => {
        goBackAndContinue(url, prevStep);
      };

    return [
      {
        popover: {
          title: 'Bienvenido a Panchería',
          description:
            'En este recorrido vas a conocer las funciones principales: ventas, productos, stock y caja.',
        },
      },
      {
        element: '[data-tour="dashboard-header"]',
        skipMissingElement: true,
        popover: {
          title: 'Panel de control',
          description:
            'Este es el panel principal. Desde acá accedés rápidamente a las secciones más usadas.',
        },
      },
      {
        element: '[data-tour="main-nav"]',
        skipMissingElement: true,
        popover: {
          title: 'Menú superior',
          description:
            'Estos son los accesos directos a cada sección. Podés usarlos para moverte en cualquier momento.',
        },
      },
      {
        element: '[data-tour="dashboard-ventas"]',
        skipMissingElement: true,
        popover: {
          title: 'Ventas',
          description:
            'La terminal de ventas permite registrar pedidos de forma rápida. Vamos a verla en detalle.',
          onNextClick: nextOn(routes.ventas, 4),
        },
      },
      {
        element: '[data-tour="caja-status"]',
        skipMissingElement: true,
        waitForElement: 5000,
        popover: {
          title: 'Estado de la caja',
          description:
            'Antes de vender tenés que abrir la caja. Acá ves si está abierta, quién la abrió y el tiempo transcurrido.',
          onPrevClick: prevOn(routes.home, 3),
        },
      },
      {
        element: '[data-tour="sales-products"]',
        skipMissingElement: true,
        waitForElement: 5000,
        popover: {
          title: 'Productos disponibles',
          description:
            'Aparecen los productos, promos y servicios que se pueden vender. El sistema calcula cuántas unidades podés vender según el stock de insumos.',
        },
      },
      {
        element: '[data-tour="sales-cart"]',
        skipMissingElement: true,
        waitForElement: 5000,
        popover: {
          title: 'Pedido actual',
          description:
            'Al tocar un producto se agrega al pedido. Elegís el medio de pago (efectivo o transferencia) y confirmás la venta.',
          onNextClick: nextOn(routes.productos, 7),
        },
      },
      {
        element: '[data-tour="products-table"]',
        skipMissingElement: true,
        waitForElement: 5000,
        popover: {
          title: 'Productos y promos',
          description:
            'Acá se administran todos los productos. Se agrupan por tipo: insumo crítico, insumo manual, servicio y promo.',
          onPrevClick: prevOn(routes.ventas, 6),
        },
      },
      {
        element: '[data-tour="products-new-product"]',
        skipMissingElement: true,
        popover: {
          title: 'Nuevos productos',
          description:
            'Podés crear productos individuales o promos que descontarán automáticamente el stock de sus insumos.',
          onNextClick: nextOn(routes.stock, 9),
        },
      },
      {
        element: '[data-tour="stock-table"]',
        skipMissingElement: true,
        waitForElement: 5000,
        popover: {
          title: 'Stock',
          description:
            'Controlás el inventario de cada insumo. Podés ajustar cantidades y consultar el historial de movimientos. El sistema marca con “Bajo” cuando un insumo está por debajo del mínimo.',
          onPrevClick: prevOn(routes.productos, 8),
          onNextClick: nextOn(routes.cierre, 10),
        },
      },
      {
        element: '[data-tour="caja-panel"]',
        skipMissingElement: true,
        waitForElement: 5000,
        popover: {
          title: 'Cierre de caja',
          description:
            'Acá cerrás la caja del día y ves el resumen: total, efectivo, transferencia, productos vendidos e insumos consumidos.',
          onPrevClick: prevOn(routes.stock, 9),
          onNextClick: nextOn(routes.cierreHistorial, 11),
        },
      },
      {
        element: '[data-tour="closure-history-table"]',
        skipMissingElement: true,
        waitForElement: 5000,
        popover: {
          title: 'Historial de cierres',
          description:
            'En esta tabla se guardan todos los cierres diarios, con el total desglosado por fecha, cantidad de ventas, efectivo y transferencia.',
          onPrevClick: prevOn(routes.cierre, 10),
        },
      },
      {
        popover: {
          title: 'Fin del recorrido',
          description:
            'Eso es todo. Ya conocés las funciones principales de Panchería. Podés repetir esta guía cuando quieras desde el botón “Guía”.',
        },
      },
    ];
  }, [navigateAndContinue, goBackAndContinue]);

  const startTour = useCallback(
    (stepIndex?: number) => {
      if (driverRef.current?.isActive()) return;

      isNavigatingRef.current = false;
      setTourActive(keys);
      const steps = buildSteps();

      const driverObj = driver({
        showProgress: true,
        showButtons: ['next', 'previous', 'close'],
        animate: true,
        overlayOpacity: 0.7,
        overlayColor: '#000000',
        allowClose: true,
        allowKeyboardControl: true,
        popoverClass: 'pancheria-tour-popover',
        nextBtnText: 'Siguiente',
        prevBtnText: 'Anterior',
        doneBtnText: 'Finalizar',
        progressText: '{{current}} de {{total}}',
        disableActiveInteraction: false,
        steps,
        onHighlightStarted: () => setIsActive(true),
        onDestroyStarted: () => {
          if (isNavigatingRef.current) return;
          setIsActive(false);
        },
        onDestroyed: () => {
          if (isNavigatingRef.current) return;
          clearStep(keys);
          clearTourActive(keys);
          markTourSeen(keys);
          setIsActive(false);
          driverRef.current = null;
        },
        onNextClick: (_element, _step, { driver }) => {
          driver.moveNext();
        },
        onPrevClick: (_element, _step, { driver }) => {
          driver.movePrevious();
        },
        onCloseClick: (_element, _step, { driver }) => {
          clearStep(keys);
          clearTourActive(keys);
          markTourSeen(keys);
          driver.destroy();
        },
        onDoneClick: (_element, _step, { driver }) => {
          clearStep(keys);
          clearTourActive(keys);
          markTourSeen(keys);
          driver.destroy();
        },
      });

      driverRef.current = driverObj;
      setIsActive(true);
      driverObj.drive(stepIndex ?? 0);
    },
    [buildSteps, keys]
  );

  const restartTour = useCallback(() => {
    stopTour();
    saveStep(keys, 0);
    setTourActive(keys);
    setIsActive(true);
    driverRef.current?.destroy();
    driverRef.current = null;

    if (pathname !== routes.home) {
      isNavigatingRef.current = true;
      router.push(routes.home);
    } else {
      isNavigatingRef.current = false;
      startTour(0);
    }
  }, [keys, pathname, router, startTour, stopTour]);

  useEffect(() => {
    const savedStep = getSavedStep(keys);
    if (getTourActive(keys) && savedStep !== null) {
      clearStep(keys);
      startTour(savedStep);
    }
  }, [pathname, startTour, keys]);

  return (
    <TourContext.Provider value={{ startTour, restartTour, stopTour, isActive }}>
      {children}
    </TourContext.Provider>
  );
}
