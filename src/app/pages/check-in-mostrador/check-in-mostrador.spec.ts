import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { CheckinMostrador } from './check-in-mostrador';

describe('CheckinMostrador', () => {
  let component: CheckinMostrador;
  let fixture: ComponentFixture<CheckinMostrador>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CheckinMostrador],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(CheckinMostrador);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
