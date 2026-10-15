import { CargoEvento } from '../models/dominio.models';
import {
  cambiosAsignarTitular,
  cambiosCopiarCatalogo,
  cambiosEliminarCargo,
  cambiosMoverTarea,
  cambiosQuitarDelEquipo,
  cargoDeTitular,
  ordenarCargosEvento,
} from './cargos-evento';

const cargo = (id: string, titularId: string | null, tareas: CargoEvento['tareas'] = []): CargoEvento => ({
  id,
  nombre: id,
  orden: 1,
  manejaInvitados: false,
  titularId,
  origenCatalogoId: null,
  tareas,
});

describe('cargos-evento', () => {
  it('ordena cargos y tareas y completa valores por defecto', () => {
    const r = ordenarCargosEvento({
      b: { nombre: 'B', orden: 2 },
      a: { nombre: 'A', orden: 1, tareas: { t2: { titulo: 'dos', orden: 2 }, t1: { titulo: 'uno', orden: 1, estado: 'hecho' } } },
    });
    expect(r.map((c) => c.id)).toEqual(['a', 'b']);
    expect(r[0].tareas.map((t) => t.id)).toEqual(['t1', 't2']);
    expect(r[0].tareas[1].estado).toBe('pendiente');
    expect(r[1].titularId).toBeNull();
    expect(r[1].manejaInvitados).toBeFalse();
  });

  it('encuentra el cargo que ya ocupa un titular, ignorando el cargo indicado', () => {
    const cargos = [cargo('c1', 'u1'), cargo('c2', null)];
    expect(cargoDeTitular(cargos, 'u1')?.id).toBe('c1');
    expect(cargoDeTitular(cargos, 'u1', 'c1')).toBeNull();
    expect(cargoDeTitular(cargos, 'u2')).toBeNull();
  });

  it('copia el catálogo con tareas pendientes, origen y marca catalogoCopiado', () => {
    let n = 0;
    const c = cambiosCopiarCatalogo(
      'e1',
      [{ id: 'k1', nombre: 'Bar', orden: 1, manejaInvitados: true, actualizadoPor: 'u', actualizadoEn: 1, tareas: [{ id: 't1', titulo: 'Hielo', orden: 1 }] }],
      () => `n${++n}`
    );
    expect(c['eventos/e1/catalogoCopiado']).toBeTrue();
    expect(c['eventos/e1/cargos/n1']).toEqual({
      nombre: 'Bar',
      orden: 1,
      manejaInvitados: true,
      titularId: null,
      origenCatalogoId: 'k1',
      tareas: { t1: { titulo: 'Hielo', orden: 1, estado: 'pendiente' } },
    });
  });

  it('asigna titular y ocupación juntos', () => {
    expect(cambiosAsignarTitular('e1', 'c1', 'u1')).toEqual({
      'eventos/e1/cargos/c1/titularId': 'u1',
      'eventos/e1/ocupacion/c1': 'u1',
    });
  });

  it('mueve una tarea conservando id y estado', () => {
    const origen = cargo('c1', null, [{ id: 't1', titulo: 'X', orden: 1, estado: 'hecho', hechoPor: 'u1', hechoEn: 5 }]);
    expect(cambiosMoverTarea('e1', origen, 't1', 'c2')).toEqual({
      'eventos/e1/cargos/c1/tareas/t1': null,
      'eventos/e1/cargos/c2/tareas/t1': { titulo: 'X', orden: 1, estado: 'hecho', hechoPor: 'u1', hechoEn: 5 },
    });
    expect(cambiosMoverTarea('e1', origen, 't1', 'c1')).toEqual({});
  });

  it('eliminar cargo borra también su ocupación', () => {
    expect(cambiosEliminarCargo('e1', 'c1')).toEqual({ 'eventos/e1/cargos/c1': null, 'eventos/e1/ocupacion/c1': null });
  });

  it('quitar del equipo libera sus cargos', () => {
    const c = cambiosQuitarDelEquipo('e1', 'u1', [cargo('c1', 'u1'), cargo('c2', 'u2')]);
    expect(c).toEqual({
      'eventos/e1/equipo/u1': null,
      'eventos/e1/cargos/c1/titularId': null,
      'eventos/e1/ocupacion/c1': null,
    });
  });
});
