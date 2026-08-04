import { NextResponse } from 'next/server';
import * as stockService from '@/application/services/stockService';

export async function GET() {
  try {
    const stock = await stockService.listStockAlerts();
    return NextResponse.json(stock);
  } catch (error) {
    console.error('Error al obtener stock:', error);
    return NextResponse.json(
      { error: 'Error al obtener stock' },
      { status: 500 }
    );
  }
}
