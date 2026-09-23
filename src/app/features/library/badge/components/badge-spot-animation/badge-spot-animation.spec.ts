import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BadgeSpotAnimation } from './badge-spot-animation';

describe('BadgeSpotAnimation', () => {
  let component: BadgeSpotAnimation;
  let fixture: ComponentFixture<BadgeSpotAnimation>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BadgeSpotAnimation],
    }).compileComponents();

    fixture = TestBed.createComponent(BadgeSpotAnimation);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
