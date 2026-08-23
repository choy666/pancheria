const STORAGE_KEY = 'pancheria-last-customer-name';

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

export function getLastCustomerName(): string | null {
  const storage = getStorage();
  return storage.getItem(STORAGE_KEY);
}

export function setLastCustomerName(name: string): void {
  const storage = getStorage();
  const trimmed = name.trim();
  if (trimmed) {
    storage.setItem(STORAGE_KEY, trimmed);
  } else {
    storage.removeItem(STORAGE_KEY);
  }
}


