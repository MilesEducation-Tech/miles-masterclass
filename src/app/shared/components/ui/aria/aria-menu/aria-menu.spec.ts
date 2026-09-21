import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AriaMenu } from './aria-menu';

describe('AriaMenu', () => {
  let component: AriaMenu;
  let fixture: ComponentFixture<AriaMenu>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AriaMenu],
    }).compileComponents();

    fixture = TestBed.createComponent(AriaMenu);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
