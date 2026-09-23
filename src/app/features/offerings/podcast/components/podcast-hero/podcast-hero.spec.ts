import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PodcastHero } from './podcast-hero';

describe('PodcastHero', () => {
  let component: PodcastHero;
  let fixture: ComponentFixture<PodcastHero>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PodcastHero],
    }).compileComponents();

    fixture = TestBed.createComponent(PodcastHero);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
