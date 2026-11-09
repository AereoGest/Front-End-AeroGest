import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VentasAdmin } from './ventas-admin';

describe('VentasAdmin', () => {
  let component: VentasAdmin;
  let fixture: ComponentFixture<VentasAdmin>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VentasAdmin],
    }).compileComponents();

    fixture = TestBed.createComponent(VentasAdmin);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
