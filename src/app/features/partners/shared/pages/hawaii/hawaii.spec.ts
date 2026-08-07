import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Hawaii } from './hawaii';

describe('Hawaii', () => {
  let component: Hawaii;
  let fixture: ComponentFixture<Hawaii>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Hawaii],
    }).compileComponents();

    fixture = TestBed.createComponent(Hawaii);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
