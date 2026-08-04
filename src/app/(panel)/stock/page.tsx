import { StockList } from '@/components/stock/stock-list';

export default function StockPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Stock</h1>
      <StockList />
    </div>
  );
}
