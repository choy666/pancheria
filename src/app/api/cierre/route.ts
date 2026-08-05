import { NextRequest, NextResponse } from 'next/server';
import * as closureService from '@/application/services/closureService';
import { DomainError, UnauthorizedError } from '@/domain/errors';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const date = dateParam ? new Date(dateParam) : new Date();

    const closure = await closureService.getClosureByDate(date);
    return NextResponse.json(closure ?? null);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    console.error('Error al obtener cierre:', error);
    return NextResponse.json(
      { error: 'Error al obtener cierre' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const date = body.date ? new Date(body.date) : new Date();
    const closure = await closureService.generateClosure(date);
    return NextResponse.json(closure, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof DomainError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error('Error al generar cierre:', error);
    return NextResponse.json(
      { error: 'Error al generar cierre' },
      { status: 500 }
    );
  }
}
