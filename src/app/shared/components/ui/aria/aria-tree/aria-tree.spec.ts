import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AriaTree } from './aria-tree';

describe('AriaTree', () => {
  let component: AriaTree;
  let fixture: ComponentFixture<AriaTree>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AriaTree],
    }).compileComponents();

    fixture = TestBed.createComponent(AriaTree);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
