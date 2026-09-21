import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlainLayout } from './plain-layout';

describe('PlainLayout', () => {
  let component: PlainLayout;
  let fixture: ComponentFixture<PlainLayout>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlainLayout],
    }).compileComponents();

    fixture = TestBed.createComponent(PlainLayout);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
