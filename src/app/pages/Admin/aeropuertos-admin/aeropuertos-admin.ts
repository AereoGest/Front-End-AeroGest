import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AeropuertoService } from '../../../services/aeropuerto-service';
import { Aeropuerto } from '../../../Models/Aeropuerto';
import { TranslatePipe } from '../../../pipes/translate.pipe';
import { I18nService } from '../../../services/i18n';

// Mismas reglas que valida el backend en AeropuertoDTO
const CODIGO_IATA = /^[A-Za-z]{3}$/;
const SOLO_LETRAS = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ ]+$/;

@Component({
  selector: 'app-aeropuertos-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './aeropuertos-admin.html',
  styleUrl: './aeropuertos-admin.css',
})
export class AeropuertosAdmin implements OnInit {
  private readonly aeropuertoService = inject(AeropuertoService);
  protected readonly i18n = inject(I18nService);

  // ── Datos principales ──
  aeropuertos = signal<Aeropuerto[]>([]);
  cargando = signal(true);
  error = signal(false);

  // ── Alertas de operación ──
  mensajeExito = signal<string | null>(null);
  mensajeError = signal<string | null>(null);

  // ── Filtros (se aplican en el front, sin volver a pedir al backend) ──
  nombre = signal('');
  codigoIata = signal('');
  ciudad = signal('');
  pais = signal('');

  // ── Modales y estado de formularios ──
  // El mismo formulario se usa para el alta y la modificación:
  // si aeropuertoEnEdicion es null es un alta, si no, una modificación.
  modalFormularioAbierto = signal(false);
  modalBajaAbierto = signal(false);
  guardando = signal(false);
  eliminando = signal(false);
  formularioError = signal<string | null>(null);

  // Formulario Alta / Edición
  aeropuertoEnEdicion = signal<Aeropuerto | null>(null);
  formNombre = signal('');
  formCodigoIata = signal('');
  formCiudad = signal('');
  formPais = signal('');

  // Modal Baja
  aeropuertoAEliminar = signal<Aeropuerto | null>(null);

  filtrados = computed(() => {
    const nombre = this.normalizar(this.nombre());
    const codigoIata = this.normalizar(this.codigoIata());
    const ciudad = this.normalizar(this.ciudad());
    const pais = this.normalizar(this.pais());

    return this.aeropuertos()
      .filter((a) => !nombre || this.normalizar(a.nombre).includes(nombre))
      .filter((a) => !codigoIata || this.normalizar(a.codigoIata).includes(codigoIata))
      .filter((a) => !ciudad || this.normalizar(a.ciudad).includes(ciudad))
      .filter((a) => !pais || this.normalizar(a.pais).includes(pais))
      .sort((x, y) => x.codigoIata.localeCompare(y.codigoIata));
  });

  hayFiltros = computed(() => !!(this.nombre() || this.codigoIata() || this.ciudad() || this.pais()));

  ngOnInit(): void {
    this.cargar();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.modalFormularioAbierto()) this.cerrarModalFormulario();
    if (this.modalBajaAbierto()) this.cerrarModalBaja();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(false);

    this.aeropuertoService.getTodos().subscribe({
      next: (lista) => {
        this.aeropuertos.set(lista ?? []);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set(true);
        this.cargando.set(false);
      },
    });
  }

  limpiarAlertas(): void {
    this.mensajeExito.set(null);
    this.mensajeError.set(null);
  }

  limpiarFiltros(): void {
    this.nombre.set('');
    this.codigoIata.set('');
    this.ciudad.set('');
    this.pais.set('');
  }

  // ---- Handlers de inputs ----
  valor(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  // ================= Alta y Modificación de Aeropuerto =================

  abrirModalAlta(): void {
    this.limpiarAlertas();
    this.formularioError.set(null);
    this.aeropuertoEnEdicion.set(null);
    this.formNombre.set('');
    this.formCodigoIata.set('');
    this.formCiudad.set('');
    this.formPais.set('');
    this.modalFormularioAbierto.set(true);
  }

  abrirModalEdicion(a: Aeropuerto): void {
    this.limpiarAlertas();
    this.formularioError.set(null);
    this.aeropuertoEnEdicion.set(a);
    this.formNombre.set(a.nombre);
    this.formCodigoIata.set(a.codigoIata);
    this.formCiudad.set(a.ciudad);
    this.formPais.set(a.pais);
    this.modalFormularioAbierto.set(true);
  }

  cerrarModalFormulario(): void {
    this.modalFormularioAbierto.set(false);
    this.aeropuertoEnEdicion.set(null);
    this.formularioError.set(null);
  }

  guardar(): void {
    const nombre = this.formNombre().trim();
    const codigoIata = this.formCodigoIata().trim().toUpperCase();
    const ciudad = this.formCiudad().trim();
    const pais = this.formPais().trim();

    if (!nombre) {
      this.formularioError.set(this.i18n.t('adminAirports.errNameRequired'));
      return;
    }
    if (!CODIGO_IATA.test(codigoIata)) {
      this.formularioError.set(this.i18n.t('adminAirports.errIataInvalid'));
      return;
    }
    if (!SOLO_LETRAS.test(ciudad)) {
      this.formularioError.set(this.i18n.t('adminAirports.errCityInvalid'));
      return;
    }
    if (!SOLO_LETRAS.test(pais)) {
      this.formularioError.set(this.i18n.t('adminAirports.errCountryInvalid'));
      return;
    }

    this.guardando.set(true);
    this.formularioError.set(null);

    const dto = { nombre, codigoIata, ciudad, pais };
    const actual = this.aeropuertoEnEdicion();
    const peticion = actual
      ? this.aeropuertoService.actualizarAeropuerto(actual.id, dto)
      : this.aeropuertoService.crearAeropuerto(dto);

    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.cerrarModalFormulario();
        this.mensajeExito.set(
          this.i18n.t(actual ? 'adminAirports.successUpdated' : 'adminAirports.successCreated')
        );
        this.cargar();
      },
      error: (err: HttpErrorResponse) => {
        this.guardando.set(false);
        const msg = err.error?.message || this.i18n.t('common.error');
        this.formularioError.set(msg);
      },
    });
  }

  // ================= Baja de Aeropuerto =================

  abrirModalBaja(a: Aeropuerto): void {
    this.limpiarAlertas();
    this.aeropuertoAEliminar.set(a);
    this.modalBajaAbierto.set(true);
  }

  cerrarModalBaja(): void {
    this.modalBajaAbierto.set(false);
    this.aeropuertoAEliminar.set(null);
  }

  confirmarBaja(): void {
    const a = this.aeropuertoAEliminar();
    if (!a) return;

    this.eliminando.set(true);
    this.aeropuertoService.eliminarAeropuerto(a.id).subscribe({
      next: () => {
        this.eliminando.set(false);
        this.cerrarModalBaja();
        this.mensajeExito.set(this.i18n.t('adminAirports.successDeleted'));
        this.cargar();
      },
      error: (err: HttpErrorResponse) => {
        this.eliminando.set(false);
        // 409: el backend no deja borrarlo porque hay vuelos que usan este aeropuerto
        const msg =
          err.status === 409
            ? this.i18n.t('adminAirports.errInUse')
            : err.error?.message || this.i18n.t('common.error');
        this.mensajeError.set(msg);
        this.cerrarModalBaja();
      },
    });
  }

  // ---- Helpers ----
  private normalizar(s: string): string {
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  }
}
