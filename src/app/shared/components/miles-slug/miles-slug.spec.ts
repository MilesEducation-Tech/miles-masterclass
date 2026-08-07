import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MilesSlug } from './miles-slug';

describe('MilesSlug', () => {
  let component: MilesSlug;
  let fixture: ComponentFixture<MilesSlug>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MilesSlug],
    }).compileComponents();

    fixture = TestBed.createComponent(MilesSlug);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
