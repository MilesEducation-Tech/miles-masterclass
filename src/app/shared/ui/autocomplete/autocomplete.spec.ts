import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Autocomplete } from './autocomplete';

describe('Autocomplete', () => {
  let component: Autocomplete;
  let fixture: ComponentFixture<Autocomplete>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Autocomplete],
    }).compileComponents();

    fixture = TestBed.createComponent(Autocomplete);
    // `id` is `input.required` — it is what ties the label, the listbox and the
    // aria-activedescendant together, so there is no sensible default.
    fixture.componentRef.setInput('id', 'country');
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
