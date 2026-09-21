import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { Faculty } from './faculty';

describe('Faculty', () => {
  let component: Faculty;
  let fixture: ComponentFixture<Faculty>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Faculty],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(Faculty);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
