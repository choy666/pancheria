import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatMoney } from '@/lib/money';
import type { Branch } from '@/domain/types';

interface PedidoCustomerFormProps {
  customerName: string;
  setCustomerName: (value: string) => void;
  customerPhone: string;
  setCustomerPhone: (value: string) => void;
  deliveryType: 'delivery' | 'pickup';
  setDeliveryType: (value: 'delivery' | 'pickup') => void;
  address: string;
  setAddress: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
  checkoutError: string | null;
  total: number;
  activeBranch: Branch;
}

export function PedidoCustomerForm({
  customerName,
  setCustomerName,
  customerPhone,
  setCustomerPhone,
  deliveryType,
  setDeliveryType,
  address,
  setAddress,
  notes,
  setNotes,
  checkoutError,
  total,
  activeBranch,
}: PedidoCustomerFormProps) {
  return (
    <div className="space-y-4 py-2">
      {checkoutError && (
        <div className="rounded-lg bg-destructive/15 p-3 text-sm text-destructive">
          {checkoutError}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="customerName">Nombre</Label>
        <Input
          id="customerName"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="Tu nombre"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="customerPhone">Teléfono</Label>
        <Input
          id="customerPhone"
          type="tel"
          value={customerPhone}
          onChange={(e) => setCustomerPhone(e.target.value)}
          placeholder="Ej: 3415555555"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="deliveryType">Tipo de entrega</Label>
        <Select
          value={deliveryType}
          onValueChange={(value) =>
            setDeliveryType(value as 'delivery' | 'pickup')
          }
        >
          <SelectTrigger id="deliveryType">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="delivery">Envío a domicilio</SelectItem>
            <SelectItem value="pickup">
              Retiro en sucursal: {activeBranch.name}
            </SelectItem>
          </SelectContent>
          {deliveryType === 'pickup' && activeBranch.address && (
            <p className="text-sm text-muted-foreground">
              Dirección de retiro: {activeBranch.address}
            </p>
          )}
        </Select>
      </div>

      {deliveryType === 'delivery' && (
        <div className="space-y-2">
          <Label htmlFor="address">Dirección</Label>
          <Input
            id="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Dirección de envío"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="notes">Notas (opcional)</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Comentarios sobre el pedido"
        />
      </div>

      <div className="border-t border-white/10 pt-3">
        <p className="font-mono text-xl font-bold">
          Total: {formatMoney(total)}
        </p>
      </div>
    </div>
  );
}
