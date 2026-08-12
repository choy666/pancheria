'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { driver } from 'driver.js';
import type { DriveStep, Driver } from 'driver.js';
import { Button } from '@/components/ui/button';
import { HelpCircle, X } from 'lucide-react';

const TOUR_STEP_KEY = 'pancheria-tour-step';
const TOUR_SEEN_KEY = 'pancheria-tour-seen';

interface TourContextValue {
  startTour: () => void;
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
  const { startTour, stopTour, isActive } = useTour();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={isActive ? stopTour : startTour}
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

function getSavedStep(): number | null {
  if (!isLocalStorageAvailable()) return null;
  const raw = window.localStorage.getItem(TOUR_STEP_KEY);
  if (raw === null) return null;
  const step = Number(raw);
  return Number.isFinite(step) && step >= 0 ? step : null;
}

function saveStep(step: number) {
  if (isLocalStorageAvailable()) {
    window.localStorage.setItem(TOUR_STEP_KEY, String(step));
  }
}

function clearStep() {
  if (isLocalStorageAvailable()) {
    window.localStorage.removeItem(TOUR_STEP_KEY);
  }
}

function markTourSeen() {
  if (isLocalStorageAvailable()) {
    window.localStorage.setItem(TOUR_SEEN_KEY, 'true');
  }
}

function hasSeenTour(): boolean {
  if (!isLocalStorageAvailable()) return false;
  return window.localStorage.getItem(TOUR_SEEN_KEY) === 'true';
}

interface TourProviderProps {
  children: React.ReactNode;
}

export function TourProvider({ children }: TourProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const driverRef = useRef<Driver | null>(null);
  const isNavigatingRef = useRef(false);
  const [isActive, setIsActive] = useState(false);

  const stopTour = useCallback(() => {
    isNavigatingRef.current = false;
    driverRef.current?.destroy();
    driverRef.current = null;
    clearStep();
    markTourSeen();
    setIsActive(false);
  }, []);

  const navigateAndContinue = useCallback(
    (url: string, nextStep: number) => {
      isNavigatingRef.current = true;
      saveStep(nextStep);
      driverRef.current?.destroy();
      driverRef.current = null;
      router.push(url);
    },
    [router]
  );

  const goBackAndContinue = useCallback(
    (url: string, prevStep: number) => {
      isNavigatingRef.current = true;
      saveStep(prevStep);
      driverRef.current?.destroy();
      driverRef.current = null;
      router.push(url);
    },
    [router]
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
        popover: {
          title: 'Panel de control',
          description:
            'Este es el panel principal. Desde acá accedés rápidamente a las secciones más usadas.',
        },
      },
      {
        element: '[data-tour="main-nav"]',
        popover: {
          title: 'Menú superior',
          description:
            'Estos son los accesos directos a cada sección. Podés usarlos para moverte en cualquier momento.',
        },
      },
      {
        element: '[data-tour="dashboard-ventas"]',
        popover: {
          title: 'Ventas',
          description:
            'La terminal de ventas permite registrar pedidos de forma rápida. Vamos a verla en detalle.',
          onNextClick: nextOn('/ventas', 4),
        },
      },
      {
        element: '[data-tour="caja-status"]',
        waitForElement: 5000,
        popover: {
          title: 'Estado de la caja',
          description:
            'Antes de vender tenés que abrir la caja. Acá ves si está abierta, quién la abrió y el tiempo transcurrido.',
          onPrevClick: prevOn('/', 3),
        },
      },
      {
        element: '[data-tour="sales-products"]',
        waitForElement: 5000,
        popover: {
          title: 'Productos disponibles',
          description:
            'Aparecen los productos, promos y servicios que se pueden vender. El sistema calcula cuántas unidades podés vender según el stock de insumos.',
        },
      },
      {
        element: '[data-tour="sales-cart"]',
        waitForElement: 5000,
        popover: {
          title: 'Pedido actual',
          description:
            'Al tocar un producto se agrega al pedido. Elegís el medio de pago (efectivo o transferencia) y confirmás la venta.',
          onNextClick: nextOn('/productos', 7),
        },
      },
      {
        element: '[data-tour="products-table"]',
        waitForElement: 5000,
        popover: {
          title: 'Productos y promos',
          description:
            'Acá se administran todos los productos. Se agrupan por tipo: insumo crítico, insumo manual, servicio y promo.',
          onPrevClick: prevOn('/ventas', 6),
        },
      },
      {
        element: '[data-tour="products-new-product"]',
        popover: {
          title: 'Nuevos productos',
          description:
            'Podés crear productos individuales o promos que descontarán automáticamente el stock de sus insumos.',
          onNextClick: nextOn('/stock', 9),
        },
      },
      {
        element: '[data-tour="stock-table"]',
        waitForElement: 5000,
        popover: {
          title: 'Stock',
          description:
            'Controlás el inventario de cada insumo. Podés ajustar cantidades y consultar el historial de movimientos. El sistema marca con “Bajo” cuando un insumo está por debajo del mínimo.',
          onPrevClick: prevOn('/productos', 8),
          onNextClick: nextOn('/cierre', 10),
        },
      },
      {
        element: '[data-tour="caja-panel"]',
        waitForElement: 5000,
        popover: {
          title: 'Cierre de caja',
          description:
            'Acá cerrás la caja del día y ves el resumen: total, efectivo, transferencia, productos vendidos e insumos consumidos.',
          onPrevClick: prevOn('/stock', 9),
          onNextClick: nextOn('/cierre/historial', 11),
        },
      },
      {
        element: '[data-tour="closure-history-table"]',
        waitForElement: 5000,
        popover: {
          title: 'Historial de cierres',
          description:
            'En esta tabla se guardan todos los cierres diarios, con el total desglosado por fecha, cantidad de ventas, efectivo y transferencia.',
          onPrevClick: prevOn('/cierre', 10),
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
          clearStep();
          markTourSeen();
          setIsActive(false);
          driverRef.current = null;
        },
      });

      driverRef.current = driverObj;
      setIsActive(true);
      driverObj.drive(stepIndex ?? 0);
    },
    [buildSteps]
  );

  useEffect(() => {
    const savedStep = getSavedStep();
    if (savedStep !== null) {
      clearStep();
      startTour(savedStep);
    } else if (pathname === '/' && !hasSeenTour()) {
      startTour(0);
    }
  }, [pathname, startTour]);

  return (
    <TourContext.Provider value={{ startTour, stopTour, isActive }}>
      {children}
    </TourContext.Provider>
  );
}
