import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { CheckInService } from '../../services/check-in-service';
import { CheckinMostradorRequest, CheckinResultado, ReservaCheckin } from '../../Models/Check-in';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { I18nService } from '../../services/i18n';


@Component({
  selector: 'app-checkin-mostrador',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, TranslatePipe],
  templateUrl: './check-in-mostrador.html',
  styleUrl: './check-in-mostrador.css',
})
export class CheckinMostrador {
  private fb = inject(FormBuilder);
  private checkinService = inject(CheckInService);
  private i18n = inject(I18nService);

  form = this.fb.nonNullable.group({
    codigoReserva: ['', [Validators.required]],
    documento: ['', [Validators.required]],
  });

  reserva = signal<ReservaCheckin | null>(null);
  resultado = signal<CheckinResultado | null>(null);
  cargando = signal(false);
  error = signal<string | null>(null);

  // Guardo los datos con los que se encontró la reserva, para confirmar con esos
  // aunque el empleado edite el formulario mientras tanto.
  private datosBusqueda: CheckinMostradorRequest | null = null;

  yaTieneCheckin = computed(() => !!this.reserva()?.fechaCheckIn);
  puedeConfirmar = computed(() => {
    const r = this.reserva();
    return !!r && r.estado === 'CONFIRMADO' && !r.fechaCheckIn;
  });

  motivoNoDisponible = computed(() => {
    const r = this.reserva();
    if (!r) return null;
    if (r.fechaCheckIn) return 'counterCheckin.alreadyDone' as const;
    if (r.estado === 'CANCELADA') return 'counterCheckin.canceled' as const;
    if (r.estado !== 'CONFIRMADO') return 'counterCheckin.notPaid' as const;
    return null;
  });

  buscar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const datos = this.form.getRawValue();
    this.cargando.set(true);
    this.error.set(null);
    this.reserva.set(null);
    this.resultado.set(null);

    this.checkinService.buscar(datos).subscribe({
      next: (r) => {
        this.reserva.set(r);
        this.datosBusqueda = datos;
        this.cargando.set(false);
      },
      error: (e) => this.manejarError(e),
    });
  }

  confirmar(): void {
    if (!this.datosBusqueda || !this.puedeConfirmar()) return;
    this.cargando.set(true);
    this.error.set(null);

    this.checkinService.confirmar(this.datosBusqueda).subscribe({
      next: (res) => {
        this.resultado.set(res);
        this.cargando.set(false);
      },
      error: (e) => this.manejarError(e),
    });
  }

  nuevoCheckin(): void {
    this.form.reset();
    this.reserva.set(null);
    this.resultado.set(null);
    this.error.set(null);
    this.datosBusqueda = null;
  }

  private manejarError(e: HttpErrorResponse): void {
    this.cargando.set(false);
    if (e.status === 0) {
      this.error.set(this.i18n.t('counterCheckin.connectionError'));
    } else if (e.status === 403) {
      this.error.set(this.i18n.t('counterCheckin.forbidden'));
    } else {
      this.error.set(e.error?.message ?? this.i18n.t('common.error'));
    }
  }
}