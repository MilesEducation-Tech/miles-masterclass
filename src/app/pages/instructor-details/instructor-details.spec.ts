import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InstructorDetails } from './instructor-details';

describe('InstructorDetails', () => {
  let component: InstructorDetails;
  let fixture: ComponentFixture<InstructorDetails>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InstructorDetails],
    }).compileComponents();

    fixture = TestBed.createComponent(InstructorDetails);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
