import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ChapterFacade } from '../../../services/chapter-facade';
import { MasterclassFacade } from '../../../services/masterclass-facade';

import { MasterclassChapter } from './masterclass-chapter';

describe('MasterclassChapter', () => {
  let component: MasterclassChapter;
  let fixture: ComponentFixture<MasterclassChapter>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MasterclassChapter],
      providers: [
        // Route-scoped, not `providedIn: 'root'` — it is listed in a route's
        // `providers`, so a spec has to provide it by hand.
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        ChapterFacade,
        MasterclassFacade,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MasterclassChapter);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
