import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { Accordion } from './accordion/accordion';
import { Avatar } from './avatar/avatar';
import { Button } from './button/button';
import { Checkbox } from './checkbox/checkbox';
import { Combobox } from './combobox/combobox';
import { DatePicker } from './date-picker/date-picker';
import { Field } from './field/field';
import { FileUpload } from './file-upload/file-upload';
import { Input } from './input/input';
import { InputOtp } from './input-otp/input-otp';
import { Listbox } from './listbox/listbox';
import { NativeSelect } from './native-select/native-select';
import { Pagination } from './pagination/pagination';
import { RadioGroup } from './radio/radio-group';
import { Rating } from './rating/rating';
import { Search } from './search/search';
import { Select } from './select/select';
import { Separator } from './separator/separator';
import { Slider } from './slider/slider';
import { Switch } from './switch/switch';
import { Tabs } from './tabs/tabs';
import { Textarea } from './textarea/textarea';
import { Toggle } from './toggle/toggle';
import { Toolbar } from './toolbar/toolbar';
import { ToggleGroup } from './toggle-group/toggle-group';

/**
 * Compiles every kit component that can stand on its own, so the whole of shared/ui is
 * AOT-checked by `ng test --include 'src/app/shared/ui/**'` even while the rest of the app is
 * mid-migration. Components that need a manager (dialog, toast) or a parent (radio-item,
 * toggle-group-item, listbox-option, accordion-item, tab, toolbar-button) or a required input
 * (meter, progress) are rendered by their stories instead.
 */
const STANDALONE: [string, Type<unknown>][] = [
  ['Button', Button],
  ['Field', Field],
  ['Input', Input],
  ['Textarea', Textarea],
  ['NativeSelect', NativeSelect],
  ['Separator', Separator],
  ['Checkbox', Checkbox],
  ['Switch', Switch],
  ['Toggle', Toggle],
  ['RadioGroup', RadioGroup],
  ['ToggleGroup', ToggleGroup],
  ['Rating', Rating],
  ['Slider', Slider],
  ['Select', Select],
  ['Combobox', Combobox],
  ['Listbox', Listbox],
  ['Search', Search],
  ['InputOtp', InputOtp],
  ['Pagination', Pagination],
  ['DatePicker', DatePicker],
  ['Accordion', Accordion],
  ['Tabs', Tabs],
  ['Toolbar', Toolbar],
  ['Avatar', Avatar],
  ['FileUpload', FileUpload],
];

describe('shared/ui kit', () => {
  it.each(STANDALONE)('%s compiles and renders', async (_name, component) => {
    const fixture = TestBed.createComponent(component);
    await fixture.whenStable();

    expect(fixture.nativeElement).toBeTruthy();
  });
});
