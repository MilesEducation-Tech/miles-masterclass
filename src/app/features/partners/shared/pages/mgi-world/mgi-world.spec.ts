import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MgiWorld } from './mgi-world';

describe('MgiWorld', () => {
  let component: MgiWorld;
  let fixture: ComponentFixture<MgiWorld>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MgiWorld],
    }).compileComponents();

    fixture = TestBed.createComponent(MgiWorld);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
