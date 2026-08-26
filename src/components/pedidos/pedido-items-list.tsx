interface OrderDetailItem {
  id: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  product?: {
    name: string;
    unit: string;
  } | null;
}

interface PedidoItemsListProps {
  items: OrderDetailItem[];
}

export function PedidoItemsList({ items }: PedidoItemsListProps) {
  return (
    <div className="rounded-2xl border border-white/8">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/8 text-left text-muted-foreground">
            <th className="p-3">Producto</th>
            <th className="p-3 text-right">Cantidad</th>
            <th className="p-3 text-right">Precio unitario</th>
            <th className="p-3 text-right">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-white/8 last:border-0">
              <td className="p-3">
                {item.product?.name ?? `Producto ${item.productId}`}
              </td>
              <td className="p-3 text-right">{item.quantity}</td>
              <td className="p-3 text-right">
                ${item.unitPrice.toFixed(2)}
              </td>
              <td className="p-3 text-right font-mono">
                ${item.subtotal.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
