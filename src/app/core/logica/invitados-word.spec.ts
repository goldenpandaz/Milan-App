import { celdasDesdeTextoWord } from './invitados-word';

describe('celdasDesdeTextoWord', () => {
  it('lee títulos de mesa, ignora números de fila y quita el número antes del nombre', () => {
    const texto = 'Mesa 1\n1\nHARRY\n2\nHIJA DE VALENTINA\nMesa\n2\n1 DAYANA\n2. RICHARD';
    expect(celdasDesdeTextoWord(texto)).toEqual(['Mesa 1', 'HARRY', 'HIJA DE VALENTINA', 'Mesa 2', 'DAYANA', 'RICHARD']);
  });

  it('une "Mesa" con "Principal"', () => {
    expect(celdasDesdeTextoWord('Mesa\nPrincipal\nELISABETH')).toEqual(['Mesa Principal', 'ELISABETH']);
  });
});
