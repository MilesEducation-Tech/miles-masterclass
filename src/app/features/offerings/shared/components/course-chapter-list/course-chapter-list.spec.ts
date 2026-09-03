import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MasterclassChapterList } from './course-chapter-list';

describe('MasterclassChapterList', () => {
  let component: MasterclassChapterList;
  let fixture: ComponentFixture<MasterclassChapterList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MasterclassChapterList],
    }).compileComponents();

    fixture = TestBed.createComponent(MasterclassChapterList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
