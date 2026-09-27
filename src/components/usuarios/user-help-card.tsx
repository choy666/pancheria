import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

/**
 * Ayuda contextual del usuario: qué efecto tiene cada dato aguas abajo
 * (acceso al panel, aislamiento por sucursal). Va dentro del formulario,
 * arriba — mismo patrón que `BranchHelpCard` y `ProductHelpCard`.
 */
export function UserHelpCard() {
  return (
    <Card data-testid="user-help-card">
      <CardHeader>
        <CardTitle className="text-base">
          Qué afecta esta configuración
        </CardTitle>
        <CardDescription>
          Los usuarios creados acá son operadores: acceden al panel con estas
          credenciales.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-base text-muted-foreground">
        <p>
          <strong className="text-foreground">Nombre de usuario:</strong> es
          la credencial de ingreso al panel y debe ser único.
        </p>
        <p>
          <strong className="text-foreground">Sucursal:</strong> limita lo que
          el operador ve y opera: ventas, stock, caja y pedidos solo de su
          sucursal asignada.
        </p>
        <p>
          <strong className="text-foreground">Contraseña:</strong> en edición
          puede quedar en blanco para conservar la actual; el usuario también
          puede cambiarla desde &quot;Mi perfil&quot;.
        </p>
        <p>
          <strong className="text-foreground">Administrador:</strong> la
          cuenta administradora inicial no puede editarse ni eliminarse desde
          esta sección.
        </p>
      </CardContent>
    </Card>
  );
}
