import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { VerPerfil } from './verPerfil';

describe('VerPerfil', () => {
  let component: VerPerfil;
  let fixture: ComponentFixture<VerPerfil>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VerPerfil],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VerPerfil);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('debería crearse correctamente', () => {
    expect(component).toBeTruthy();
  });
});
