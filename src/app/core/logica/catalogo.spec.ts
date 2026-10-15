import { nombreRepetido, normalizarNombre, ordenarCatalogo, siguienteOrden } from './catalogo';

describe('catalogo', () => {
  it('ordena cargos y tareas por orden y les agrega id y opciones', () => {
    const resultado = ordenarCatalogo({
      b: { nombre: 'Mesero 2', orden: 2, actualizadoPor: 'u', actualizadoEn: 1 },
      a: {
        nombre: 'Mesero 1',
        orden: 1,
        manejaInvitados: true,
        actualizadoPor: 'u',
        actualizadoEn: 1,
        tareas: { t2: { titulo: 'segunda', orden: 2 }, t1: { titulo: 'primera', orden: 1 } },
      },
    });
    expect(resultado.map((c) => c.id)).toEqual(['a', 'b']);
    expect(resultado[0].tareas.map((t) => t.id)).toEqual(['t1', 't2']);
    expect(resultado[1].tareas).toEqual([]);
    expect(resultado[0].manejaInvitados).toBeTrue();
    expect(resultado[1].manejaInvitados).toBeFalse();
  });

  it('devuelve vacío si no hay catálogo', () => {
    expect(ordenarCatalogo(null)).toEqual([]);
  });

  it('calcula el siguiente orden', () => {
    expect(siguienteOrden([{ orden: 1 }, { orden: 3 }])).toBe(4);
    expect(siguienteOrden([])).toBe(1);
  });

  it('normaliza nombres sin mayúsculas, tildes ni espacios de más', () => {
    expect(normalizarNombre('  Ángel   Bar ')).toBe('angel bar');
  });

  it('detecta nombres repetidos e ignora el cargo que se está editando', () => {
    const cargos = [{ id: 'a', nombre: 'Mesero 1' }, { id: 'b', nombre: 'Portero' }];
    expect(nombreRepetido(' mesero  1 ', cargos)).toBeTrue();
    expect(nombreRepetido('Mesero 1', cargos, 'a')).toBeFalse();
    expect(nombreRepetido('Bar', cargos)).toBeFalse();
  });
});
