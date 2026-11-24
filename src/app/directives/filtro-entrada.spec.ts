import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { beforeEach, describe, expect, it } from 'vitest';
import { FiltroEntradaDirective } from './filtro-entrada';

@Component({
  standalone: true,
  imports: [FormsModule, FiltroEntradaDirective],
  template: `
    <input id="letras" type="text" appFiltroEntrada="letras" [(ngModel)]="texto" />
    <input id="entero" type="number" appFiltroEntrada="entero" [maxDigitos]="3" [valorMaximo]="maximo()" [(ngModel)]="cantidad" />
    <input id="decimal" type="number" appFiltroEntrada="decimal" [maxDigitos]="5" [maxDecimales]="2" [(ngModel)]="monto" />
  `,
})
class HostTest {
  texto = '';
  cantidad: number | null = null;
  monto: number | null = null;
  readonly maximo = signal<number | null>(null);
}

/** Simula una tecla: devuelve true si el navegador la hubiera dejado pasar. */
function escribir(input: HTMLInputElement, data: string): boolean {
  const ev = new InputEvent('beforeinput', { data, inputType: 'insertText', cancelable: true, bubbles: true });
  return input.dispatchEvent(ev);
}

/** Simula que el valor del campo cambió (como si el navegador lo hubiera insertado). */
function cambiarValor(input: HTMLInputElement, valor: string): void {
  input.value = valor;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function pegar(input: HTMLInputElement, texto: string): boolean {
  const ev = new Event('paste', { cancelable: true, bubbles: true });
  Object.defineProperty(ev, 'clipboardData', { value: { getData: () => texto } });
  return input.dispatchEvent(ev);
}

describe('FiltroEntradaDirective', () => {
  let fixture: ComponentFixture<HostTest>;
  let host: HostTest;
  const campo = (id: string) => fixture.nativeElement.querySelector(`#${id}`) as HTMLInputElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostTest] }).compileComponents();
    fixture = TestBed.createComponent(HostTest);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  describe('letras', () => {
    it('deja escribir letras con tilde y espacios', () => {
      expect(escribir(campo('letras'), 'á')).toBe(true);
      expect(escribir(campo('letras'), 'Ñ')).toBe(true);
      expect(escribir(campo('letras'), ' ')).toBe(true);
    });

    it('bloquea números y símbolos', () => {
      expect(escribir(campo('letras'), '5')).toBe(false);
      expect(escribir(campo('letras'), '@')).toBe(false);
    });

    it('al pegar, descarta los números y deja el resto', () => {
      expect(pegar(campo('letras'), 'Córdoba 123')).toBe(false);
      expect(campo('letras').value).toBe('Córdoba ');
      expect(host.texto).toBe('Córdoba ');
    });

    it('limpia el valor si un número llegó a entrar', () => {
      cambiarValor(campo('letras'), 'Mar1 del Plata');
      expect(host.texto).toBe('Mar del Plata');
    });
  });

  describe('entero', () => {
    it('bloquea "e", "-", "+" y separadores decimales', () => {
      for (const c of ['e', 'E', '-', '+', '.', ',']) {
        expect(escribir(campo('entero'), c)).toBe(false);
      }
      expect(escribir(campo('entero'), '7')).toBe(true);
    });

    it('limita la cantidad de dígitos', () => {
      cambiarValor(campo('entero'), '12345');
      expect(campo('entero').value).toBe('123');
      expect(host.cantidad).toBe(123);
    });

    it('no deja superar el valor máximo', () => {
      host.maximo.set(180);
      fixture.detectChanges();
      cambiarValor(campo('entero'), '250');
      expect(host.cantidad).toBe(180);
    });

    it('rechaza pegar un número negativo', () => {
      expect(pegar(campo('entero'), '-5')).toBe(false);
      expect(pegar(campo('entero'), '42')).toBe(true);
    });
  });

  describe('decimal', () => {
    it('bloquea "e", "-" y "+" pero deja el punto decimal', () => {
      for (const c of ['e', 'E', '-', '+']) {
        expect(escribir(campo('decimal'), c)).toBe(false);
      }
      expect(escribir(campo('decimal'), '.')).toBe(true);
    });

    it('corrige notación científica que llegue a entrar', () => {
      cambiarValor(campo('decimal'), '1e5');
      expect(host.monto).toBe(15);
    });

    it('limita los decimales y los dígitos enteros', () => {
      cambiarValor(campo('decimal'), '1500.999');
      expect(host.monto).toBe(1500.99);
      cambiarValor(campo('decimal'), '1234567');
      expect(host.monto).toBe(12345);
    });
  });
});
