import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { MiCarrito } from './carrito';

describe('MiCarrito', () => {
  let component: MiCarrito;
  let fixture: ComponentFixture<MiCarrito>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MiCarrito],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MiCarrito);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('debería crearse correctamente', () => {
    expect(component).toBeTruthy();
  });
});
