import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NgpToastManager } from 'ng-primitives/toast';

import type { TextDirection } from '../../models/language.model';
import { LanguageContext } from '../language-context/language-context';
import { NotificationService, TOAST_COMPONENT } from './notification';

@Component({ template: '' })
class FakeToast {}

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NotificationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

describe('NotificationService placement', () => {
  function placements(dir: TextDirection): unknown[] {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: LanguageContext, useValue: { dir } },
        { provide: TOAST_COMPONENT, useValue: FakeToast },
      ],
    });
    const show = vi
      .spyOn(TestBed.inject(NgpToastManager), 'show')
      .mockReturnValue(undefined as never);
    const notify = TestBed.inject(NotificationService);
    notify.info('t', 'm');
    notify.info('t', 'm', { position: 'bottom-left' });
    notify.info('t', 'm', { position: 'top-center' });
    return show.mock.calls.map(([, options]) => (options as { placement: unknown }).placement);
  }

  it('maps the physical position names onto the primitive’s start/end', () => {
    expect(placements('ltr')).toEqual(['top-end', 'bottom-start', 'top-center']);
  });

  // The primitive puts `end` on the physical right; on an Arabic page the default corner is the left.
  it('mirrors start and end on a right-to-left page', () => {
    expect(placements('rtl')).toEqual(['top-start', 'bottom-end', 'top-center']);
  });
});
