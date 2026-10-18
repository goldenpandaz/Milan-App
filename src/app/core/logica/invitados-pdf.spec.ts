import { ItemPdf, celdasDesdePaginasPdf } from './invitados-pdf';

const t = (str: string, x: number, y: number): ItemPdf => ({ str, x, y });

describe('celdasDesdePaginasPdf', () => {
  it('lee dos mesas lado a lado, con títulos partidos y nombres en dos líneas', () => {
    const pagina = [
      t('Mes', 298, 700),
      t('a 2', 298, 688),
      t('Mesa 1', 104, 688),
      t('1', 146, 660),
      t('HARRY', 161, 660),
      t('2', 146, 628),
      t('HIJA DE', 161, 640),
      t('VALENTINA', 161, 628),
      t('3', 146, 610),
      t('1', 328, 660),
      t('DAYANA', 341, 660),
      t('2', 328, 628),
      t('RICHARD', 341, 628),
      t('3', 328, 610),
    ];
    expect(celdasDesdePaginasPdf([pagina])).toEqual(['MESA 1', 'HARRY', 'HIJA DE VALENTINA', 'MESA 2', 'DAYANA', 'RICHARD']);
  });

  it('reconoce la mesa principal y un título "Mesa 11" partido', () => {
    const principal = [t('M', 104, 700), t('Principal', 104, 688), t('1', 146, 660), t('ELISABETH', 161, 660)];
    const once = [t('Mesa', 104, 700), t('11', 104, 688), t('1', 146, 660), t('ALEX', 161, 660)];
    expect(celdasDesdePaginasPdf([principal, once])).toEqual(['MESA PRINCIPAL', 'ELISABETH', 'MESA 11', 'ALEX']);
  });

  it('devuelve vacío si no hay tablas', () => {
    expect(celdasDesdePaginasPdf([[t('hola', 10, 10)]])).toEqual([]);
  });
});
