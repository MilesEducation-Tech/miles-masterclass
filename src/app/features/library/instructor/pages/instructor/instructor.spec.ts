import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { Instructor } from './instructor';

describe('Instructor', () => {
  let component: Instructor;
  let fixture: ComponentFixture<Instructor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Instructor],
      // Without the testing backend this spec made a REAL request to the UAT
      // API and failed on its 404. A unit test must never perform network I/O.
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(Instructor);
    component = fixture.componentInstance;
    fixture.detectChanges();

    // The facade's `resource()` loaders are promises; `whenStable()` never
    // settles until the testing backend answers them.
    const http = TestBed.inject(HttpTestingController);
    for (const request of http.match(() => true)) {
      request.flush({ status_code: 200, data: [], message: 'ok' });
    }
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
