import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VuelosAdmin } from './vuelos-admin';

describe('VuelosAdmin', () => {
  let component: VuelosAdmin;
  let fixture: ComponentFixture<VuelosAdmin>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VuelosAdmin],
    }).compileComponents();

    fixture = TestBed.createComponent(VuelosAdmin);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
