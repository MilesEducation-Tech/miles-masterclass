import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CpeComplianceDialog } from './cpe-compliance-dialog';

describe('CpeComplianceDialog', () => {
  let component: CpeComplianceDialog;
  let fixture: ComponentFixture<CpeComplianceDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CpeComplianceDialog],
    }).compileComponents();

    fixture = TestBed.createComponent(CpeComplianceDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
