import { ComponentFixture, TestBed } from '@angular/core/testing';

import { provideMockDialogRef, stubDialogShell } from '@testing/mocks/dialog-ref.mock';

import { ShareDialog } from './share-dialog';

describe('ShareDialog', () => {
  let component: ShareDialog;
  let fixture: ComponentFixture<ShareDialog>;

  beforeEach(async () => {
    stubDialogShell(ShareDialog);
    await TestBed.configureTestingModule({
      imports: [ShareDialog],
      providers: [provideMockDialogRef({ url: 'https://example.com/course' })],
    }).compileComponents();

    fixture = TestBed.createComponent(ShareDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
