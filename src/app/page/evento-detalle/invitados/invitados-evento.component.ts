import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InvitadosService } from '../../../core/services/invitados.service';
import { AuthService } from '../../../core/services/auth.service';
import { InvitadoEvento, InvitadosArchivo } from '../../../core/models/dominio.models';
import { InvitadoParseado, contarPorMesa, filtrarInvitados } from '../../../core/logica/invitados';
import { BadgeComponent } from '../../../shared/components/badge/badge.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';

type Modo = 'mesa' | 'todos';

interface GrupoMesa {
  mesa: string | null;
  invitados: InvitadoEvento[];
  llegaron: number;
  total: number;
}

@Component({
  selector: 'app-invitados-evento',
  standalone: true,
  imports: [CommonModule, FormsModule, BadgeComponent, ModalComponent],
  templateUrl: './invitados-evento.component.html',
})
export class InvitadosEventoComponent implements OnInit {
  @Input({ required: true }) eventoId = '';
  /** Admin, jefe de meseros o titular de un cargo con lista de invitados. */
  @Input() puedeMarcar = false;
  /** Todo trabajador ve la lista; solo quien puede marcar cambia la llegada. */
  @Input() puedeVer = false;
  /** Solo el admin sube o re-sube el archivo. */
  @Input() puedeSubir = false;
  /** Cargo con lista de invitados del que es titular quien marca (null para admin y jefe). */
  @Input() cargoId: string | null = null;

  invitados: InvitadoEvento[] = [];
  cargando = true;
  error = '';
  modo: Modo = 'mesa';
  busqueda = '';
  /** Ids con una marca en curso, para no disparar dos escrituras seguidas sobre la misma fila. */
  enCurso = new Set<string>();

  leyendo = false;
  errorArchivo = '';
  previa: InvitadoParseado[] | null = null;
  /** Archivo tal cual lo eligió el usuario, en espera de confirmar la subida. */
  archivoPendiente: { nombre: string; base64: string } | null = null;
  subiendo = false;

  /** El archivo original ya guardado, para poder descargarlo igual como se subió. */
  archivo: InvitadosArchivo | null = null;

  constructor(private servicio: InvitadosService, private auth: AuthService) {}

  get uid(): string {
    return this.auth.getSession()?.localId ?? '';
  }

  ngOnInit(): void {
    if (this.puedeMarcar || this.puedeVer) this.cargar();
  }

  descargar(): void {
    if (this.archivo) this.servicio.descargar(this.archivo);
  }

  get filtrados(): InvitadoEvento[] {
    return filtrarInvitados(this.invitados, this.busqueda);
  }

  get llegaron(): number {
    return this.invitados.filter((i) => i.asistio).length;
  }

  get grupos(): GrupoMesa[] {
    const visibles = this.filtrados;
    return contarPorMesa(this.invitados).map(({ mesa }) => {
      const todos = this.invitados.filter((i) => i.mesa === mesa);
      return {
        mesa,
        invitados: visibles.filter((i) => i.mesa === mesa),
        llegaron: todos.filter((i) => i.asistio).length,
        total: todos.length,
      };
    }).filter((g) => g.invitados.length > 0);
  }

  get conteoPrevia(): { mesa: string | null; total: number }[] {
    return this.previa ? contarPorMesa(this.previa) : [];
  }

  cargar(): void {
    this.cargando = true;
    this.servicio.listar(this.eventoId).subscribe({
      next: (lista) => {
        this.invitados = lista;
        this.cargando = false;
      },
      error: () => {
        this.error = 'No se pudo cargar la lista de invitados.';
        this.cargando = false;
      },
    });
    this.servicio.archivoActual(this.eventoId).subscribe((archivo) => (this.archivo = archivo));
  }

  trackId(_: number, i: InvitadoEvento): string {
    return i.id;
  }

  /** Optimista: cambia al instante y revierte si la escritura falla. */
  alternar(invitado: InvitadoEvento): void {
    if (this.enCurso.has(invitado.id)) return;
    const anterior = { asistio: invitado.asistio, asistioPor: invitado.asistioPor, asistioEn: invitado.asistioEn };
    invitado.asistio = !invitado.asistio;
    invitado.asistioPor = this.uid;
    invitado.asistioEn = Date.now();
    this.enCurso.add(invitado.id);
    this.servicio.marcarAsistencia(this.eventoId, invitado.id, invitado.asistio, this.uid, this.cargoId).subscribe({
      next: () => this.enCurso.delete(invitado.id),
      error: () => {
        Object.assign(invitado, anterior);
        this.enCurso.delete(invitado.id);
        this.error = `No se pudo guardar la llegada de ${invitado.nombre}. Intenta de nuevo.`;
      },
    });
  }

  async elegirArchivo(evento: Event): Promise<void> {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo) return;
    this.errorArchivo = '';
    const nombre = archivo.name.toLowerCase();
    if (!nombre.endsWith('.xlsx') && !nombre.endsWith('.pdf')) {
      this.errorArchivo = 'El archivo debe ser un Excel (.xlsx) o un PDF.';
      return;
    }
    this.leyendo = true;
    const resultado = await this.servicio.leerArchivo(archivo);
    this.leyendo = false;
    if (!resultado.ok) {
      this.errorArchivo = resultado.error;
      return;
    }
    if (resultado.invitados.length === 0) {
      this.errorArchivo = 'El archivo no tiene invitados.';
      return;
    }
    this.previa = resultado.invitados;
    this.archivoPendiente = resultado.archivoOriginal ?? null;
  }

  confirmarSubida(): void {
    if (!this.previa || !this.archivoPendiente || this.subiendo) return;
    this.subiendo = true;
    this.servicio.subir(this.eventoId, this.invitados, this.previa, this.archivoPendiente, this.uid).subscribe({
      next: () => {
        this.subiendo = false;
        this.previa = null;
        this.archivoPendiente = null;
        this.cargar();
      },
      error: () => {
        this.subiendo = false;
        this.errorArchivo = 'No se pudo guardar la lista. Intenta de nuevo.';
      },
    });
  }
}
