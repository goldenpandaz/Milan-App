import { nombreDeCargoNuevo, ordenarCatalogo, puedeAgregarDesmontaje, siguienteNumeroMesero } from './catalogo';

describe('catalogo', () => {
  it('ordena cargos y tareas por orden y les agrega id', () => {
    const resultado = ordenarCatalogo({
      b: { nombre: 'Mesero 2', tipo: 'mesero', orden: 2, actualizadoPor: 'u', actualizadoEn: 1 },
      a: {
        nombre: 'Mesero 1',
        tipo: 'mesero',
        orden: 1,
        actualizadoPor: 'u',
        actualizadoEn: 1,
        tareas: { t2: { titulo: 'segunda', orden: 2 }, t1: { titulo: 'primera', orden: 1 } },
      },
    });
    expect(resultado.map((c) => c.id)).toEqual(['a', 'b']);
    expect(resultado[0].tareas.map((t) => t.id)).toEqual(['t1', 't2']);
    expect(resultado[1].tareas).toEqual([]);
  });

  it('devuelve vacío si no hay catálogo', () => {
    expect(ordenarCatalogo(null)).toEqual([]);
  });

  it('numera el siguiente mesero con el mayor + 1, sin reutilizar huecos', () => {
    const cargos = [
      { nombre: 'Mesero 1', tipo: 'mesero' as const },
      { nombre: 'Mesero 3', tipo: 'mesero' as const },
      { nombre: 'Portero', tipo: 'portero' as const },
    ];
    expect(siguienteNumeroMesero(cargos)).toBe(4);
    expect(siguienteNumeroMesero([])).toBe(1);
  });

  it('solo permite un desmontaje', () => {
    expect(puedeAgregarDesmontaje([{ tipo: 'mesero' }])).toBeTrue();
    expect(puedeAgregarDesmontaje([{ tipo: 'desmontaje' }])).toBeFalse();
  });

  it('arma el nombre de un cargo nuevo', () => {
    const cargos = [{ nombre: 'Mesero 1', tipo: 'mesero' as const }];
    expect(nombreDeCargoNuevo('mesero', '', cargos)).toBe('Mesero 2');
    expect(nombreDeCargoNuevo('portero', '', cargos)).toBe('Portero');
    expect(nombreDeCargoNuevo('libre', '  Bar  ', cargos)).toBe('Bar');
    expect(nombreDeCargoNuevo('libre', '', cargos)).toBe('');
  });
});
