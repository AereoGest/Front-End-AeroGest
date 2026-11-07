import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CheckInMostrador } from './check-in-mostrador';

describe('CheckInMostrador', () => {
  let component: CheckInMostrador;
  let fixture: ComponentFixture<CheckInMostrador>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CheckInMostrador],
    }).compileComponents();

    fixture = TestBed.createComponent(CheckInMostrador);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
