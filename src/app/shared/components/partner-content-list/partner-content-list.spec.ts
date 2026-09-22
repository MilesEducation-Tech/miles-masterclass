import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PartnerContentList } from './partner-content-list';

describe('PartnerContentList', () => {
  let component: PartnerContentList;
  let fixture: ComponentFixture<PartnerContentList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PartnerContentList],
    }).compileComponents();

    fixture = TestBed.createComponent(PartnerContentList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
