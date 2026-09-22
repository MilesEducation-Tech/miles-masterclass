import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AllinialGlobal } from './allinial-global';

describe('AllinialGlobal', () => {
  let component: AllinialGlobal;
  let fixture: ComponentFixture<AllinialGlobal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AllinialGlobal],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(AllinialGlobal);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
