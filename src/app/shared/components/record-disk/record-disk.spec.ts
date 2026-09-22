import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecordDisk } from './record-disk';

describe('RecordDisk', () => {
  let component: RecordDisk;
  let fixture: ComponentFixture<RecordDisk>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecordDisk],
    }).compileComponents();

    fixture = TestBed.createComponent(RecordDisk);
    fixture.componentRef.setInput(
      'coverImage',
      'https://placehold.co/400x400/2d1b69/ffffff?text=Podcast',
    );
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
