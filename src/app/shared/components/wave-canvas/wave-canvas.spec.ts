import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WaveCanvas } from './wave-canvas';

describe('WaveCanvas', () => {
  let component: WaveCanvas;
  let fixture: ComponentFixture<WaveCanvas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WaveCanvas],
    }).compileComponents();

    fixture = TestBed.createComponent(WaveCanvas);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
