# Architecture Decision Records

One file per decision, numbered, never rewritten. When a decision changes, add a new ADR and mark
the old one **Superseded by ADR-XXXX** — the reasoning that was true at the time stays readable.

Write one when a choice is expensive to reverse, contradicts a rule already written down, or is the
kind of thing someone will ask "why is it like this?" about in six months. Not for routine calls.

| #                                 | Title                                                     | Status   |
| --------------------------------- | --------------------------------------------------------- | -------- |
| [0001](0001-service-decorator.md) | Use the `@Service` decorator instead of `@Injectable`     | Accepted |
| [0002](0002-no-external-store.md) | No external state store; signal services + `httpResource` | Accepted |
