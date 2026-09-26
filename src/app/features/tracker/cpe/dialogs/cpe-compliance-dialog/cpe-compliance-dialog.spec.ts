import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideMockDialogRef, stubDialogShell } from '@testing/mocks/dialog-ref.mock';

import { CpeComplianceDialog } from './cpe-compliance-dialog';

describe('CpeComplianceDialog', () => {
  let component: CpeComplianceDialog;
  let fixture: ComponentFixture<CpeComplianceDialog>;

  beforeEach(async () => {
    stubDialogShell(CpeComplianceDialog);
    await TestBed.configureTestingModule({
      imports: [CpeComplianceDialog],
      providers: [provideMockDialogRef()],
    }).compileComponents();

    fixture = TestBed.createComponent(CpeComplianceDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
