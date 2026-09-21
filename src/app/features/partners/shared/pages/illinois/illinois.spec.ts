import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Illinois } from './illinois';

describe('Illinois', () => {
  let component: Illinois;
  let fixture: ComponentFixture<Illinois>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Illinois],
    }).compileComponents();

    fixture = TestBed.createComponent(Illinois);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
