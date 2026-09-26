import { ComponentFixture, TestBed } from '@angular/core/testing';

import { provideMockDialogRef, stubDialogShell } from '@testing/mocks/dialog-ref.mock';

import { FilterDialog } from './filter-dialog';

describe('FilterDialog', () => {
  let component: FilterDialog;
  let fixture: ComponentFixture<FilterDialog>;

  beforeEach(async () => {
    stubDialogShell(FilterDialog);
    await TestBed.configureTestingModule({
      imports: [FilterDialog],
      providers: [provideMockDialogRef({ topics: [] })],
    }).compileComponents();

    fixture = TestBed.createComponent(FilterDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
