import { Question } from '@core/models/account.model';
import { controlOf, keysToValues, optionKey, valuesToKeys } from './profile';

/**
 * The payload→control→payload mapping, which is the part of this page that can
 * break silently: a wrong key turns a saved answer into an unselected option
 * and nothing throws.
 *
 * Built from the real `GET questions/` payload — option values are LISTS even
 * for a single-select, which is the detail everything here turns on.
 */
function question(overrides: Partial<Question> = {}): Question {
  return {
    id: '97a6c335-5155-4ac8-b7e9-dc042a5675a5',
    code: 'user_intent',
    question: 'What brings you to Miles Masterclass?',
    help_text: '',
    placeholder: '',
    answer_format: 'single_select',
    section: '',
    visibility: 'onboarding',
    display_order: 0,
    is_required: true,
    validation: null,
    parent_question: null,
    parent_answer_value: null,
    options: [
      { text: "I'm a licensed accountant", value: ['licensed_accountant'] },
      { text: "I'm a working professional", value: ['working_professional'] },
      { text: "I'm a student", value: ['student'] },
    ],
    ...overrides,
  };
}

describe('profile question mapping', () => {
  it('round-trips a stored answer back to the option that produced it', () => {
    const q = question();
    const keys = valuesToKeys(q, ['licensed_accountant']);

    expect(keys).toEqual([optionKey(q.options[0])]);
    // And back out in the shape the API stores — the option's list, verbatim.
    expect(keysToValues(q, keys)).toEqual(['licensed_accountant']);
  });

  it('selects nothing for an answer no option carries', () => {
    expect(valuesToKeys(question(), ['retired'])).toEqual([]);
  });

  /** A multi-value option is only selected when ALL of its values are stored. */
  it('needs every value of a multi-value option present', () => {
    const q = question({
      options: [{ text: 'Both', value: ['audit', 'tax'] }],
    });

    expect(valuesToKeys(q, ['audit'])).toEqual([]);
    expect(valuesToKeys(q, ['audit', 'tax'])).toEqual(['audit|tax']);
    expect(keysToValues(q, ['audit|tax'])).toEqual(['audit', 'tax']);
  });

  /** The key is never split — the option is looked up by it. */
  it('survives a value containing the key separator', () => {
    const q = question({ options: [{ text: 'Odd', value: ['a|b'] }] });

    expect(keysToValues(q, valuesToKeys(q, ['a|b']))).toEqual(['a|b']);
  });

  it('maps every declared answer_format to its control', () => {
    const formats = [
      ['text', 'text'],
      ['textarea', 'textarea'],
      ['number', 'number'],
      ['boolean', 'boolean'],
      ['date', 'date'],
      ['single_select', 'single'],
      ['multi_select', 'multi'],
    ] as const;

    for (const [answer_format, control] of formats) {
      expect(controlOf(question({ answer_format }))).toBe(control);
    }
  });

  /** An unknown format is data, not an error: options mean a choice. */
  it('falls back on an unrecognised format', () => {
    expect(controlOf(question({ answer_format: 'rating' }))).toBe('single');
    expect(controlOf(question({ answer_format: 'rating', options: [] }))).toBe('text');
  });
});
