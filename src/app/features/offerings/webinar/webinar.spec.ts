import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Webinar } from './webinar';

describe('Webinar', () => {
  let component: Webinar;
  let fixture: ComponentFixture<Webinar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Webinar],
    }).compileComponents();

    fixture = TestBed.createComponent(Webinar);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
