import { TestBed } from '@angular/core/testing';
import { LanguageContext } from '@core/services/language-context/language-context';
import { provideTranslocoTesting } from '@testing/transloco';
import { LanguageSwitcher } from './language-switcher';

describe('LanguageSwitcher', () => {
  const use = vi.fn();

  function render(): HTMLSelectElement {
    use.mockClear();
    TestBed.configureTestingModule({
      imports: [LanguageSwitcher],
      providers: [
        provideTranslocoTesting(),
        {
          provide: LanguageContext,
          useValue: { current: 'fr', enabled: ['en', 'fr', 'ar'], use },
        },
      ],
    });
    const fixture = TestBed.createComponent(LanguageSwitcher);
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('select');
  }

  it('lists each enabled language by its own name, tagged for screen readers', () => {
    const options = [...render().options];
    expect(options.map((o) => o.textContent?.trim())).toEqual(['English', 'Français', 'العربية']);
    expect(options.map((o) => o.lang)).toEqual(['en', 'fr', 'ar']);
  });

  it('shows the current language as selected', () => {
    expect(render().value).toBe('fr');
  });

  it('has an accessible name', () => {
    const select = render();
    expect(select.closest('label')?.textContent).toContain('Language');
  });

  it('switches to the chosen language', () => {
    const select = render();
    select.value = 'ar';
    select.dispatchEvent(new Event('change'));
    expect(use).toHaveBeenCalledWith('ar');
  });

  it('ignores a value that is not an enabled language', () => {
    const select = render();
    const forged = document.createElement('option');
    forged.value = 'xx';
    select.appendChild(forged);
    select.value = 'xx';
    select.dispatchEvent(new Event('change'));
    expect(use).not.toHaveBeenCalled();
  });
});
