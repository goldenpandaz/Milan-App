import { InvitadoEvento } from '../models/dominio.models';
import {
  MAX_FILAS_INVITADOS,
  cambiosSubirInvitados,
  contarPorMesa,
  filtrarInvitados,
  normalizarInvitado,
  parsearCeldasInvitados,
} from './invitados';

function invitados(celdas: unknown[]) {
  const r = parsearCeldasInvitados(celdas);
  if (!r.ok) throw new Error(r.error);
  return r.invitados;
}

describe('normalizarInvitado', () => {
  it('quita tildes, pasa a minúsculas y colapsa espacios', () => {
    expect(normalizarInvitado('  José   PÉREZ ')).toBe('jose perez');
  });
});

describe('parsearCeldasInvitados', () => {
  it('agrupa por títulos de mesa', () => {
    expect(invitados(['MESA PRINCIPAL', 'Ana', 'Luis', 'MESA 1', 'Sofía'])).toEqual([
      { nombre: 'Ana', mesa: 'MESA PRINCIPAL' },
      { nombre: 'Luis', mesa: 'MESA PRINCIPAL' },
      { nombre: 'Sofía', mesa: 'MESA 1' },
    ]);
  });

  it('sin ningún título deja todos con mesa null', () => {
    expect(invitados(['Ana', 'Luis'])).toEqual([
      { nombre: 'Ana', mesa: null },
      { nombre: 'Luis', mesa: null },
    ]);
  });

  it('ignora filas vacías', () => {
    expect(invitados(['MESA 1', '', '   ', 'Ana', null, undefined])).toEqual([{ nombre: 'Ana', mesa: 'MESA 1' }]);
  });

  it('reconoce títulos con espacios de más y en minúsculas', () => {
    expect(invitados(['  mesa  5 ', 'Ana'])).toEqual([{ nombre: 'Ana', mesa: 'MESA 5' }]);
  });

  it('ignora celdas que no son texto', () => {
    expect(invitados(['MESA 2', 12, true, new Date(0), 'Ana'])).toEqual([{ nombre: 'Ana', mesa: 'MESA 2' }]);
  });

  it('rechaza archivos con más filas de texto que el máximo', () => {
    const r = parsearCeldasInvitados(Array.from({ length: MAX_FILAS_INVITADOS + 1 }, (_, i) => `Invitado ${i}`));
    expect(r.ok).toBeFalse();
  });
});

describe('contarPorMesa', () => {
  it('cuenta en orden de aparición', () => {
    expect(contarPorMesa([{ mesa: 'A' }, { mesa: 'B' }, { mesa: 'A' }])).toEqual([
      { mesa: 'A', total: 2 },
      { mesa: 'B', total: 1 },
    ]);
  });
});

describe('filtrarInvitados', () => {
  it('busca ignorando tildes y mayúsculas', () => {
    const lista = [{ nombreNormalizado: 'jose perez' }, { nombreNormalizado: 'ana' }];
    expect(filtrarInvitados(lista, 'JOSÉ')).toEqual([{ nombreNormalizado: 'jose perez' }]);
  });
});

describe('cambiosSubirInvitados', () => {
  const previo = (id: string, nombre: string, mesa: string | null, asistio: boolean): InvitadoEvento => ({
    id,
    nombre,
    nombreNormalizado: normalizarInvitado(nombre),
    mesa,
    asistio,
    orden: 0,
    asistioPor: asistio ? 'u1' : null,
    asistioEn: asistio ? 100 : null,
  });

  const archivo = { nombre: 'lista.xlsx', base64: 'QQ==', uid: 'u1' };

  it('conserva asistencia, borra no marcados y deja los marcados fuera de lista', () => {
    let n = 0;
    const cambios = cambiosSubirInvitados(
      'e1',
      [previo('a', 'Ana', 'MESA 1', true), previo('b', 'Luis', 'MESA 1', false), previo('c', 'Sofía', 'MESA 2', true)],
      [
        { nombre: 'ANA', mesa: 'MESA 3' },
        { nombre: 'Pedro', mesa: 'MESA 3' },
      ],
      () => `n${++n}`,
      500,
      archivo
    );
    expect(cambios['eventos/e1/invitadosSubidoEn']).toBe(500);
    expect(cambios['eventos/e1/invitadosArchivo']).toEqual(
      jasmine.objectContaining({ nombre: 'lista.xlsx', base64: 'QQ==', subidoPor: 'u1', subidoEn: 500 })
    );
    expect(cambios['eventos/e1/invitados/a']).toEqual(
      jasmine.objectContaining({ nombre: 'ANA', mesa: 'MESA 3', asistio: true, asistioPor: 'u1', asistioEn: 100 })
    );
    expect(cambios['eventos/e1/invitados/n1']).toEqual(jasmine.objectContaining({ nombre: 'Pedro', asistio: false }));
    expect(cambios['eventos/e1/invitados/b']).toBeNull();
    expect(cambios['eventos/e1/invitados/c']).toEqual(jasmine.objectContaining({ asistio: true, fueraDeLista: true }));
  });

  it('con nombres repetidos prefiere la misma mesa', () => {
    const cambios = cambiosSubirInvitados(
      'e1',
      [previo('a', 'Ana', 'MESA 1', false), previo('b', 'Ana', 'MESA 2', true)],
      [
        { nombre: 'Ana', mesa: 'MESA 2' },
        { nombre: 'Ana', mesa: 'MESA 1' },
      ],
      () => 'x',
      1,
      archivo
    );
    expect(cambios['eventos/e1/invitados/b']).toEqual(jasmine.objectContaining({ mesa: 'MESA 2', asistio: true }));
    expect(cambios['eventos/e1/invitados/a']).toEqual(jasmine.objectContaining({ mesa: 'MESA 1', asistio: false }));
  });
});
