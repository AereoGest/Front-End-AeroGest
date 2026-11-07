import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Checkinonline } from './check-in-online';

describe('CheckInOnline', () => {
  let component: Checkinonline;
  let fixture: ComponentFixture<Checkinonline>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Checkinonline],
    }).compileComponents();

    fixture = TestBed.createComponent(Checkinonline);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
