import { notFound } from 'next/navigation';
import { PedidoDetail } from '@/components/pedidos/pedido-detail';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PedidoDetailPage({ params }: Props) {
  const { id } = await params;
  const orderId = Number(id);

  if (Number.isNaN(orderId) || orderId <= 0) {
    notFound();
  }

  return <PedidoDetail orderId={orderId} />;
}
