import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { MasterclassFacade } from '../../../services/masterclass-facade';

import { PodcastCourse } from './podcast-course';

describe('PodcastCourse', () => {
  let component: PodcastCourse;
  let fixture: ComponentFixture<PodcastCourse>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PodcastCourse],
      providers: [
        // Route-scoped, not `providedIn: 'root'` — it is listed in a route's
        // `providers`, so a spec has to provide it by hand.
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        MasterclassFacade,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PodcastCourse);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
