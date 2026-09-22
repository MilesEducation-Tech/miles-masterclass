import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AriaInput } from './aria-input';

describe('AriaInput', () => {
  let component: AriaInput;
  let fixture: ComponentFixture<AriaInput>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AriaInput],
    }).compileComponents();

    fixture = TestBed.createComponent(AriaInput);
    fixture.componentRef.setInput('id', 'email');
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
