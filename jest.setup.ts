import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';

// Fallback para tests que construyen URLs públicas sin configurar
// explícitamente NEXT_PUBLIC_APP_URL.
process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';

afterEach(cleanup);

