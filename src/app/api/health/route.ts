import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/db';

/**
 * Health check público y sin auth: solo expone si la base responde.
 * Pensado para monitores externos (uptime) y smoke tests de despliegue.
 */
export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return NextResponse.json({
      ok: true,
      db: 'up',
      now: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        db: 'down',
        now: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
