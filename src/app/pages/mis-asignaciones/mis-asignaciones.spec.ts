import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MisAsignaciones } from './mis-asignaciones';

describe('MisAsignaciones', () => {
  let component: MisAsignaciones;
  let fixture: ComponentFixture<MisAsignaciones>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MisAsignaciones],
    }).compileComponents();

    fixture = TestBed.createComponent(MisAsignaciones);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
