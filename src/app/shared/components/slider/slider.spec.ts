import { TestBed } from '@angular/core/testing';
import { Slider } from './slider';

describe('Slider', () => {
  const mockItems: any[] = [
    {
      id: 1,
      thumbnail: 'https://example.com/1.jpg',
      title: 'Slide 1',
      course_short_overview: 'Description 1',
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
      },
      has_individual_badge: false,
    },
  ];

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
    expect(ordered[0].id).toBe('1');
    expect(ordered[1].id).toBe('2');
    expect(ordered[2].id).toBe('3');
    expect(ordered[3].id).toBe('4');
  });
});
