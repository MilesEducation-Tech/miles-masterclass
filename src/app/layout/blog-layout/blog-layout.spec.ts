import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { BlogLayout } from './blog-layout';

describe('BlogLayout', () => {
  let component: BlogLayout;
  let fixture: ComponentFixture<BlogLayout>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BlogLayout],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(BlogLayout);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
