import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SelectCpeMode } from './select-cpe-mode';

describe('SelectCpeMode', () => {
  let component: SelectCpeMode;
  let fixture: ComponentFixture<SelectCpeMode>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SelectCpeMode],
    }).compileComponents();

    fixture = TestBed.createComponent(SelectCpeMode);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
