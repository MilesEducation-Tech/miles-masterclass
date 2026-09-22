import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ConnectUs } from './connect-us';

describe('ConnectUs', () => {
  let component: ConnectUs;
  let fixture: ComponentFixture<ConnectUs>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConnectUs],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ConnectUs);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
