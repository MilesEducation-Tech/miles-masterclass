import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MasterclassCourse } from './masterclass-course';

describe('MasterclassCourse', () => {
  let component: MasterclassCourse;
  let fixture: ComponentFixture<MasterclassCourse>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MasterclassCourse],
    }).compileComponents();

    fixture = TestBed.createComponent(MasterclassCourse);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
