import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

/**
 * Ayuda contextual de la sucursal: qué efecto tiene cada dato aguas abajo
 * (catálogo público, caja, pedidos). Va dentro del formulario, arriba —
 * mismo patrón que `ProductHelpCard` en /productos.
 */
export function BranchHelpCard() {
  return (
    <Card data-testid="branch-help-card">
      <CardHeader>
        <CardTitle className="text-base">
          Qué afecta esta configuración
        </CardTitle>
        <CardDescription>
          Los datos de la sucursal se usan en el catálogo público, la caja y
          los pedidos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-base text-muted-foreground">
        <p>
          <strong className="text-foreground">Nombre:</strong> se muestra en
          el catálogo y debe ser único. La sucursal cuyo nombre coincide con
          la variable <code>DEFAULT_BRANCH_NAME</code> resuelve la URL
          canónica de <code>/pedido</code> — renombrarla o eliminarla deja
          el catálogo sin sucursal por defecto.
        </p>
        <p>
          <strong className="text-foreground">Horarios:</strong> alimentan
          el estado abierto/cerrado del catálogo y los avisos de caja por
          turnos. Si la sucursal no tiene horarios, el canal público la
          considera abierta siempre que haya una caja abierta.
        </p>
        <p>
          <strong className="text-foreground">Dirección y ubicación:</strong>{' '}
          se muestran en la tarjeta del catálogo; la dirección es la de
          retiro en los pedidos con entrega &quot;retiro en el local&quot; y
          la ubicación alimenta el mapa.
        </p>
        <p>
          <strong className="text-foreground">Teléfonos y redes:</strong> se
          muestran en la tarjeta del catálogo y en la confirmación del
          pedido.
        </p>
      </CardContent>
    </Card>
  );
}
