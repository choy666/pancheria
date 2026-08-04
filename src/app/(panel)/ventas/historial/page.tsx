import { SalesHistory } from '@/components/ventas/sales-history';
import * as saleRepository from '@/repositories/saleRepository';

export default async function SalesHistoryPage() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const sales = await saleRepository.findByDateRange(start, end);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Historial de ventas</h1>
      <SalesHistory sales={sales} />
    </div>
  );
}
