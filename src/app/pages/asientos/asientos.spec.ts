import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { registerLocaleData } from '@angular/common';
import localeEsAr from '@angular/common/locales/es-AR';
import { describe, expect, it, beforeEach } from 'vitest';
import { Asientos } from './asientos';

registerLocaleData(localeEsAr, 'es-AR');

describe('Asientos', () => {
  let component: Asientos;
  let fixture: ComponentFixture<Asientos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Asientos],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Asientos);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
