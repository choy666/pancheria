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
import { cn } from '@/lib/utils';
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
  onBeforeToggle?: () => void;
}

export function TourButton({ className, onBeforeToggle }: TourButtonProps) {
  const { restartTour, stopTour, isActive } = useTour();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => {
        onBeforeToggle?.();
        if (isActive) {
          stopTour();
        } else {
          restartTour();
        }
      }}
      className={cn('min-h-11 min-w-11', className)}
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
  role?: 'admin' | 'operator';
}

export function TourProvider({
  children,
  userId,
  branchId,
  role,
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

  function visibleElement(selector: string): () => Element {
    return (() => {
      if (typeof document === 'undefined') {
        return undefined as unknown as Element;
      }

      const el = document.querySelector(selector);
      if (!el) {
        return undefined as unknown as Element;
      }

      const rect = el.getBoundingClientRect();
      return (rect.width > 0 && rect.height > 0
        ? el
        : undefined) as unknown as Element;
    }) as () => Element;
  }

  const buildSteps = useCallback(
    (currentRole: 'admin' | 'operator'): DriveStep[] => {
      const isAdmin = currentRole === 'admin';

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

      const steps: DriveStep[] = [
        {
          popover: {
            title: 'Bienvenido a Panchería',
            description: isAdmin
              ? 'Como administrador podés gestionar sucursales, usuarios y productos. Vamos a recorrer las secciones principales del sistema.'
              : 'Como operador tu rol está limitado a las operaciones de tu sucursal asignada: ventas, stock y caja.',
          },
        },
        {
          element: '[data-tour="dashboard-header"]',
          skipMissingElement: true,
          popover: {
            title: 'Panel de control',
            description: isAdmin
              ? 'Este es el panel principal. Desde acá accedés rápidamente a Ventas, Productos, Stock y Caja.'
              : 'Este es el panel principal. Desde acá accedés a Ventas, Stock y Caja. No tenés acceso a Productos, Sucursales ni Usuarios.',
          },
        },
        {
          element: visibleElement('[data-tour="main-nav"]'),
          skipMissingElement: true,
          popover: {
            title: 'Menú superior',
            description: isAdmin
              ? 'Estos son los accesos directos a cada sección. Además de Panel, Ventas, Historial, Productos, Stock y Caja, también podés ir a Sucursales y Usuarios.'
              : 'Estos son los accesos directos. Vos ves solo Panel, Ventas, Historial, Stock y Caja, porque tu rol es operador.',
          },
        },
        {
          element: visibleElement('[data-tour="mobile-menu-button"]'),
          skipMissingElement: true,
          popover: {
            title: 'Menú',
            description:
              'En dispositivos móviles, el menú se abre desde este botón. Desde ahí accedés a las mismas secciones.',
          },
        },
        {
          element: '[data-tour="dashboard-ventas"]',
          skipMissingElement: true,
          popover: {
            title: 'Ventas',
            description:
              'La terminal de ventas permite registrar pedidos de forma rápida. Vamos a verla en detalle.',
            onNextClick: nextOn(routes.ventas, 5),
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
            onPrevClick: prevOn(routes.home, 4),
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
            onNextClick: isAdmin
              ? nextOn(routes.productos, 8)
              : nextOn(routes.stock, 8),
          },
        },
      ];

      if (isAdmin) {
        steps.push(
          {
            element: '[data-tour="products-table"]',
            skipMissingElement: true,
            waitForElement: 5000,
            popover: {
              title: 'Productos y promos',
              description:
                'Acá se administran todos los productos. Se agrupan por tipo: insumo crítico, insumo manual, servicio y promo.',
              onPrevClick: prevOn(routes.ventas, 7),
            },
          },
          {
            element: '[data-tour="products-new-product"]',
            skipMissingElement: true,
            popover: {
              title: 'Nuevos productos',
              description:
                'Podés crear productos individuales o promos que descontarán automáticamente el stock de sus insumos.',
              onNextClick: nextOn(routes.stock, 10),
            },
          }
        );
      }

      steps.push(
        {
          element: '[data-tour="stock-table"]',
          skipMissingElement: true,
          waitForElement: 5000,
          popover: {
            title: 'Stock',
            description:
              'Controlás el inventario de cada insumo. Podés ajustar cantidades y consultar el historial de movimientos. El sistema marca con “Bajo” cuando un insumo está por debajo del mínimo.',
            onPrevClick: isAdmin
              ? prevOn(routes.productos, 9)
              : prevOn(routes.ventas, 7),
            onNextClick: nextOn(routes.cierre, isAdmin ? 11 : 9),
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
            onPrevClick: prevOn(routes.stock, isAdmin ? 10 : 8),
            onNextClick: nextOn(routes.cierreHistorial, isAdmin ? 12 : 10),
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
            onPrevClick: prevOn(routes.cierre, isAdmin ? 11 : 9),
            onNextClick: isAdmin
              ? nextOn(routes.sucursales, 13)
              : undefined,
          },
        }
      );

      if (isAdmin) {
        steps.push(
          {
            element: '[data-tour="branches-header"]',
            skipMissingElement: true,
            waitForElement: 5000,
            popover: {
              title: 'Sucursales',
              description:
                'Acá administrás las sucursales del sistema. Podés crear nuevas y editar las existentes.',
              onPrevClick: prevOn(routes.cierreHistorial, 12),
              onNextClick: nextOn(routes.usuarios, 14),
            },
          },
          {
            element: '[data-tour="users-header"]',
            skipMissingElement: true,
            waitForElement: 5000,
            popover: {
              title: 'Usuarios',
              description:
                'Acá creás, editás y eliminás usuarios operador. Les asignás una sucursal y una contraseña.',
              onPrevClick: prevOn(routes.sucursales, 13),
            },
          },
          {
            element: '[data-tour="branch-selector"]',
            skipMissingElement: true,
            waitForElement: 5000,
            popover: {
              title: 'Selector de sucursal',
              description:
                'Como administrador, podés cambiar la sucursal activa para operar en cualquiera de las sucursales.',
            },
          }
        );
      }

      steps.push({
        popover: {
          title: 'Fin del recorrido',
          description:
            'Eso es todo. Ya conocés las funciones principales de Panchería. Podés repetir esta guía cuando quieras desde el botón “Guía”.',
        },
      });

      return steps;
    },
    [navigateAndContinue, goBackAndContinue]
  );

  const startTour = useCallback(
    (stepIndex?: number) => {
      if (driverRef.current?.isActive()) return;

      isNavigatingRef.current = false;
      setTourActive(keys);
      const steps = buildSteps(role ?? 'operator');

      const driverObj = driver({
        showProgress: true,
        showButtons: ['next', 'previous', 'close'],
        animate: true,
        overlayOpacity: 0.7,
        overlayColor: '#000000',
        allowClose: true,
        allowKeyboardControl: true,
        popoverClass: 'pancheria-tour-popover',
        popoverOffset: 8,
        stagePadding: 4,
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
    [buildSteps, keys, role]
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
