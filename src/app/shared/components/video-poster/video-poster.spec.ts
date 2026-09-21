import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VideoPoster } from './video-poster';

describe('VideoPoster', () => {
  let component: VideoPoster;
  let fixture: ComponentFixture<VideoPoster>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VideoPoster],
    }).compileComponents();

    fixture = TestBed.createComponent(VideoPoster);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
