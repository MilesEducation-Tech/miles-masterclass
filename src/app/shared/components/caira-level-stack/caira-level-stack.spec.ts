import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CairaLevelStack } from './caira-level-stack';

describe('CairaLevelStack', () => {
  let component: CairaLevelStack;
  let fixture: ComponentFixture<CairaLevelStack>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CairaLevelStack],
    }).compileComponents();

    fixture = TestBed.createComponent(CairaLevelStack);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
