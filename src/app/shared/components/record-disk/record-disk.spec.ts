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
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
