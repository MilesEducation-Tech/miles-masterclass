import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AriaMenubar } from './aria-menubar';

describe('AriaMenubar', () => {
  let component: AriaMenubar;
  let fixture: ComponentFixture<AriaMenubar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AriaMenubar],
    }).compileComponents();

    fixture = TestBed.createComponent(AriaMenubar);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
