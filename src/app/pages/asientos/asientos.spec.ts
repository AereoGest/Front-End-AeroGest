import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Asientos } from './asientos';

describe('Asientos', () => {
  let component: Asientos;
  let fixture: ComponentFixture<Asientos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Asientos],
    }).compileComponents();

    fixture = TestBed.createComponent(Asientos);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
