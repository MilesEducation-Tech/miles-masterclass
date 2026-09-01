import {
  LevelsPageFilteredResponse,
  LevelsPageResponse,
  toFaqEntries,
  toLevelTabs,
  toLevelsPageTitle,
} from './levels-page.model';

describe('toLevelTabs', () => {
  it('survives a half-shaped response without throwing', () => {
    // The LMS bug this guards: a raw `levels[0]` throws after state is partly
    // set, leaving the page blank below the fold.
    expect(toLevelTabs(undefined)).toEqual([]);
    expect(toLevelTabs({ status: true })).toEqual([]);
    expect(toLevelTabs({ status: true, data: null })).toEqual([]);
    expect(toLevelTabs({ status: true, data: { levels: null } })).toEqual([]);
    expect(toLevelTabs({ status: true, data: { levels: [{}] } })).toHaveLength(1);
  });

  it('coerces an empty image to null rather than an empty string', () => {
    // `ngSrc=""` throws NG02952.
    const [tab] = toLevelTabs({
      status: true,
      data: { levels: [{ id: 'l1', level_image_url: '   ', sections: [{ image_url: '' }] }] },
    });
    expect(tab.iconUrl).toBeNull();
    expect(tab.cards[0].posterUrl).toBeNull();
  });

  it('numbers objectives from position when order is missing', () => {
    const [tab] = toLevelTabs({
      status: true,
      data: {
        levels: [
          {
            id: 'l1',
            sections: [{ id: 's1', items: [{ title: 'a' }, { title: 'b', order: 9 }] }],
          },
        ],
      },
    });
    expect(tab.cards[0].objectives.map((o) => o.order)).toEqual([1, 9]);
  });

  it('keeps server order and maps the display fields', () => {
    const response: LevelsPageResponse = {
      status: true,
      data: {
        title: 'Miles Masterclass CAIRA',
        levels: [
          { id: 'l1', level_name: 'Level 1', subtitle: 'First' },
          { id: 'l2', level_name: 'Level 2' },
        ],
      },
    };
    expect(toLevelTabs(response).map((t) => t.id)).toEqual(['l1', 'l2']);
    expect(toLevelTabs(response)[0].subtitle).toBe('First');
    expect(toLevelTabs(response)[1].subtitle).toBeNull();
    expect(toLevelsPageTitle(response)).toBe('Miles Masterclass CAIRA');
  });

  it('reports a blank title as null so the caller keeps its default', () => {
    expect(toLevelsPageTitle({ status: true, data: { title: '  ' } })).toBeNull();
  });
});

describe('toFaqEntries', () => {
  const faqSection = {
    id: 's-faq',
    title: 'Frequently Asked Questions',
    items: [
      { title: 'What is CAIRA?', description: 'A credential.' },
      { title: '', description: 'orphan answer' },
    ],
  };

  it('reads the flat section array the ?type= call returns', () => {
    const response: LevelsPageFilteredResponse = { status: true, data: [faqSection] };
    expect(toFaqEntries(response)).toEqual([
      { question: 'What is CAIRA?', answer: 'A credential.' },
    ]);
  });

  it('also reads the full tree, which an unmatched type falls back to', () => {
    const response: LevelsPageFilteredResponse = {
      status: true,
      data: { levels: [{ id: 'l1', sections: [{ title: 'Overview' }, faqSection] }] },
    };
    expect(toFaqEntries(response)).toHaveLength(1);
  });

  it('takes the first FAQ section — it repeats per level', () => {
    const response: LevelsPageFilteredResponse = {
      status: true,
      data: [
        faqSection,
        { title: 'Frequently Asked Questions', items: [{ title: 'second', description: 'x' }] },
      ],
    };
    expect(toFaqEntries(response)[0].question).toBe('What is CAIRA?');
  });

  it('matches the section title case-insensitively', () => {
    expect(
      toFaqEntries({
        status: true,
        data: [{ title: 'FREQUENTLY ASKED QUESTIONS', items: [{ title: 'q', description: 'a' }] }],
      }),
    ).toHaveLength(1);
  });

  it('returns an empty list when there is no FAQ section', () => {
    expect(toFaqEntries(undefined)).toEqual([]);
    expect(toFaqEntries({ status: true, data: [] })).toEqual([]);
    expect(toFaqEntries({ status: true, data: [{ title: 'Overview' }] })).toEqual([]);
  });
});
