import { TestBed } from '@angular/core/testing';
import { Slider } from './slider';
import { Content } from '../../core/models/course.model';

/**
 * The fixture previously held ONE item while the assertions below were written
 * for four with string ids — a mock that had been trimmed without the
 * expectations following it. `totalSlides` is `items().length` and `Content.id`
 * is a number, so four numeric-id slides is what the component actually sees.
 */
function slide(id: number): Content {
  return {
    id,
    thumbnail: `https://placehold.co/400x600/1a1a2e/ffffff?text=Slide+${id}`,
    title: `Slide ${id}`,
    course_short_overview: `Description ${id}`,
    horizontal_thumbnail: '',
    square_thumbnail: null,
    course_type: '',
    podcast_format: null,
    course_category_details: {
      id: 0,
      course_name: '',
      course_category: '',
    },
    class_credits: 0,
    mobile_thumbnail_gif: '',
    thumbnail_gif: '',
    trailer_link: '',
    instructor_details: {
      id: 0,
      first_name: '',
      last_name: '',
      other_instructors: [],
    },
    has_individual_badge: false,
    caira_level: null,
    included_for_caira: false,
  };
}

describe('Slider', () => {
  const mockItems: Content[] = [slide(1), slide(2), slide(3), slide(4)];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Slider],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(Slider);
    fixture.componentRef.setInput('items', mockItems);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });

  it('should have correct total slides count', async () => {
    const fixture = TestBed.createComponent(Slider);
    fixture.componentRef.setInput('items', mockItems);
    await fixture.whenStable();
    const component = fixture.componentInstance;
    expect(component['totalSlides']()).toBe(4);
  });

  it('should start with activeIndex at 0', async () => {
    const fixture = TestBed.createComponent(Slider);
    fixture.componentRef.setInput('items', mockItems);
    await fixture.whenStable();
    const component = fixture.componentInstance;
    expect(component['activeIndex']()).toBe(0);
  });

  it('should order items correctly initially', async () => {
    const fixture = TestBed.createComponent(Slider);
    fixture.componentRef.setInput('items', mockItems);
    await fixture.whenStable();
    const component = fixture.componentInstance;
    const ordered = component['orderedItems']();
    expect(ordered.map((item) => item.id)).toEqual([1, 2, 3, 4]);
  });
});
