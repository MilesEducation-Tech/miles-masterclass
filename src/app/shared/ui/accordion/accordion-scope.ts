import { Directive } from '@angular/core';
import { provideAccordionState } from 'ng-primitives/accordion';

/**
 * Starts a fresh accordion scope, for an `ngpAccordion` nested inside another.
 *
 * `NgpAccordion` provides its state with `provideAccordionState()`, which
 * INHERITS by default: a nested accordion reuses the outer one's state signal
 * and then overwrites it with its own. Every outer item ends up bound to the
 * last nested accordion created, so clicking an outer trigger opens nothing and
 * toggles a hidden inner item instead (ng-primitives 0.131.0). Put this on an
 * element between the two accordions so the inner one gets its own signal.
 */
@Directive({
  selector: '[appAccordionScope]',
  providers: [provideAccordionState({ inherit: false })],
})
export class AccordionScope {}
