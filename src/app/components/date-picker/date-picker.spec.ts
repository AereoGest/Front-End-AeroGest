import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { I18nService } from '../../services/i18n';
import { DatePickerDirective } from './date-picker';

@Component({
  standalone: true,
  imports: [FormsModule, DatePickerDirective],
  template: `
    <input
      id="test-date"
      type="date"
      class="field-input"
      [min]="min()"
      [max]="max()"
      [ngModel]="fecha()"
      (ngModelChange)="fecha.set($event)" />
  `,
})
class HostTestComponent {
  readonly fecha = signal('1995-05-15');
  readonly min = signal('1900-01-01');
  readonly max = signal('2026-11-23');
}

describe('DatePickerDirective & DatePickerPopover', () => {
  let fixture: ComponentFixture<HostTestComponent>;
  let host: HostTestComponent;
  let i18n: I18nService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostTestComponent],
    }).compileComponents();

    i18n = TestBed.inject(I18nService);
    i18n.setLang('es');

    fixture = TestBed.createComponent(HostTestComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    document.querySelectorAll('app-date-picker-popover').forEach((n) => n.remove());
  });

  it('abre el calendario al hacer clic, permite cambiar año/mes y seleccionar un día válido', () => {
    const input = fixture.nativeElement.querySelector('#test-date') as HTMLInputElement;
    input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    fixture.detectChanges();

    const popover = document.querySelector('.ag-datepicker') as HTMLElement;
    expect(popover).toBeTruthy();

    const selectAnio = popover.querySelector('.ag-datepicker__select--anio') as HTMLSelectElement;
    expect(selectAnio).toBeTruthy();
    expect(Array.from(selectAnio.options).some((o) => o.textContent?.trim() === '1900')).toBe(true);
    expect(Array.from(selectAnio.options).some((o) => o.textContent?.trim() === '1899')).toBe(false);

    const btnDia20 = popover.querySelector('button[data-date="1995-05-20"]') as HTMLButtonElement;
    expect(btnDia20).toBeTruthy();
    expect(btnDia20.disabled).toBe(false);
    btnDia20.click();
    fixture.detectChanges();

    expect(host.fecha()).toBe('1995-05-20');
    expect(document.querySelector('.ag-datepicker')).toBeNull();
  });

  it('deshabilita fechas fuera del rango min/max y permite limpiar la fecha', () => {
    host.fecha.set('1900-01-10');
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('#test-date') as HTMLInputElement;
    input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    fixture.detectChanges();

    const popover = document.querySelector('.ag-datepicker') as HTMLElement;
    const diaAnterior1900 = popover.querySelector('button[data-date="1899-12-31"]') as HTMLButtonElement;
    expect(diaAnterior1900?.disabled).toBe(true);

    const btnLimpiar = popover.querySelector('.ag-datepicker__action') as HTMLButtonElement;
    btnLimpiar.click();
    fixture.detectChanges();

    expect(host.fecha()).toBe('');
  });
});
