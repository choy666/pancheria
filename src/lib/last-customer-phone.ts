const STORAGE_KEY = 'pancheria-last-customer-phone';

function getStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
}

export function getLastCustomerPhone(): string | null {
  const storage = getStorage();
  return storage.getItem(STORAGE_KEY);
}

export function setLastCustomerPhone(phone: string): void {
  const storage = getStorage();
  const trimmed = phone.trim().replace(/\s/g, '');
  if (trimmed) {
    storage.setItem(STORAGE_KEY, trimmed);
  } else {
    storage.removeItem(STORAGE_KEY);
  }
}
