import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AsignacionesAdmin } from './asignaciones-admin';

describe('AsignacionesAdmin', () => {
  let component: AsignacionesAdmin;
  let fixture: ComponentFixture<AsignacionesAdmin>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AsignacionesAdmin],
    }).compileComponents();

    fixture = TestBed.createComponent(AsignacionesAdmin);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
