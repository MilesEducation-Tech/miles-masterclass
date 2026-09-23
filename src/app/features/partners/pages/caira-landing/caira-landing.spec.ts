import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CairaLanding } from './caira-landing';

describe('CairaLanding', () => {
  let component: CairaLanding;
  let fixture: ComponentFixture<CairaLanding>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CairaLanding],
    }).compileComponents();

    fixture = TestBed.createComponent(CairaLanding);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
