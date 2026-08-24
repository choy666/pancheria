import dotenv from 'dotenv';

dotenv.config({ path: '.env.e2e', override: true });

process.argv = ['node', 'next', 'dev'];

import('next/dist/bin/next');
