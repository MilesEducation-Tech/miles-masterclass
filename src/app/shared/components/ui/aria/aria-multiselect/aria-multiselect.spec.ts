import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AriaMultiselect } from './aria-multiselect';

describe('AriaMultiselect', () => {
  let component: AriaMultiselect;
  let fixture: ComponentFixture<AriaMultiselect>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AriaMultiselect],
    }).compileComponents();

    fixture = TestBed.createComponent(AriaMultiselect);
    fixture.componentRef.setInput('id', 'fields-of-study');
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
