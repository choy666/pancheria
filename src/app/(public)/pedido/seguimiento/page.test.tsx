import * as pageModule from './page';

describe('/pedido/seguimiento page', () => {
  test('se renderiza por request para que los inline scripts lleven el nonce CSP', () => {
    // Si la página queda estática (prerender en build), los inline scripts del
    // bootstrap de Next salen sin nonce y la CSP de producción los bloquea:
    // la página no hidrata y el formulario de seguimiento queda inutilizable.
    expect(pageModule.dynamic).toBe('force-dynamic');
  });
});
