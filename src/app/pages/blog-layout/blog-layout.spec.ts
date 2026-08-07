import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BlogLayout } from './blog-layout';

describe('BlogLayout', () => {
  let component: BlogLayout;
  let fixture: ComponentFixture<BlogLayout>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BlogLayout],
    }).compileComponents();

    fixture = TestBed.createComponent(BlogLayout);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
