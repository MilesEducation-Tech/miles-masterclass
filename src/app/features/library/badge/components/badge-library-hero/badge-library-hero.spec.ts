import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BadgeLibraryHero } from './badge-library-hero';

describe('BadgeLibraryHero', () => {
  let component: BadgeLibraryHero;
  let fixture: ComponentFixture<BadgeLibraryHero>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BadgeLibraryHero],
    }).compileComponents();

    fixture = TestBed.createComponent(BadgeLibraryHero);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
