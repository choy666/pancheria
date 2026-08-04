import { StockList } from '@/components/stock/stock-list';

export default function StockPage() {
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Stock</h1>
      <StockList />
    </div>
  );
}
