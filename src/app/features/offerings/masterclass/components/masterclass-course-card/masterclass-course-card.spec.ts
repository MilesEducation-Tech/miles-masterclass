import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { MasterclassCourseCard } from '@features/offerings/masterclass/components/masterclass-course-card/masterclass-course-card';
import {
  MasterclassCardLayout,
  MasterclassCourse,
} from '@features/offerings/masterclass/models/masterclass-home.model';
import { mockMasterclassCourse } from '@testing/mocks/masterclass-home.mock';

describe('MasterclassCourseCard', () => {
  let fixture: ComponentFixture<MasterclassCourseCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MasterclassCourseCard],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(MasterclassCourseCard);
  });

  async function render(course: MasterclassCourse, layout: MasterclassCardLayout) {
    fixture.componentRef.setInput('course', course);
    fixture.componentRef.setInput('layout', layout);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it.each([
    ['vertical', 'https://example.test/v.png'],
    ['horizontal', 'https://example.test/h.png'],
  ] as const)('uses the %s artwork for the %s layout', async (layout, src) => {
    const el = await render(mockMasterclassCourse('c1'), layout);

    expect(el.querySelector('img')?.getAttribute('src')).toBe(src);
  });

  it('renders no <img> when the course has no artwork (ngSrc="" throws)', async () => {
    const course = mockMasterclassCourse('c1', {
      thumbnails: { horizontal: '', vertical: null, square: null },
    });

    const el = await render(course, 'horizontal');

    expect(el.querySelector('img')).toBeNull();
  });

  it('links to the course by uuid and slug', async () => {
    const el = await render(mockMasterclassCourse('c1'), 'horizontal');

    expect(el.querySelector('a')?.getAttribute('href')).toBe('/c1/course-c1');
  });

  it('shows the short description and the fields of study', async () => {
    const el = await render(mockMasterclassCourse('c1'), 'horizontal');

    expect(el.textContent).toContain('Explore how Microsoft 365 Copilot boosts productivity');
    expect(el.textContent).toContain('Information Technology');
  });

  it('shows the API total as the CPE pill, and none when the API sends null', async () => {
    let el = await render(mockMasterclassCourse('c1', { total_cpe_credits: 2 }), 'horizontal');
    expect(el.textContent).toContain('2 CPE');

    el = await render(mockMasterclassCourse('c1', { total_cpe_credits: null }), 'horizontal');
    expect(el.textContent).not.toContain('CPE');
  });

  it.each(['vertical', 'horizontal'] as const)(
    'emits the course from Trailer (%s)',
    async (layout) => {
      const course = mockMasterclassCourse('c1');
      const emitted: MasterclassCourse[] = [];
      fixture.componentInstance.trailer.subscribe((c) => emitted.push(c));

      const el = await render(course, layout);
      const trailer = [...el.querySelectorAll('button')].find((b) =>
        b.textContent?.includes('Trailer'),
      );
      trailer?.click();

      expect(emitted).toEqual([course]);
    },
  );
});
