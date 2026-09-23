import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { MgiWorld } from './mgi-world';

describe('MgiWorld', () => {
  let component: MgiWorld;
  let fixture: ComponentFixture<MgiWorld>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MgiWorld],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(MgiWorld);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
