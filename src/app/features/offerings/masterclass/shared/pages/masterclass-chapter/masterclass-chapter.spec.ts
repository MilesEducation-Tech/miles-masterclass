import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MasterclassChapter } from './masterclass-chapter';

describe('MasterclassChapter', () => {
  let component: MasterclassChapter;
  let fixture: ComponentFixture<MasterclassChapter>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MasterclassChapter],
    }).compileComponents();

    fixture = TestBed.createComponent(MasterclassChapter);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
