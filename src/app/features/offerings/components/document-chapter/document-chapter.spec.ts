import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DocumentChapter } from './document-chapter';

describe('DocumentChapter', () => {
  let component: DocumentChapter;
  let fixture: ComponentFixture<DocumentChapter>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DocumentChapter],
    }).compileComponents();

    fixture = TestBed.createComponent(DocumentChapter);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
