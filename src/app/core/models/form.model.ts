export type SelectOption<T = unknown> = T & {
  value: string;
  label: string;
  disabled?: boolean;
};

export interface AutoCompleteOption<T = unknown> {
  label: string;
  value: T;
  disabled?: boolean;
  metadata?: Record<string, unknown>;
}

export interface AutoCompleteCompleteEvent {
  query: string;
  originalEvent: Event;
}

export interface AutoCompleteSelectEvent<T = unknown> {
  value: T;
  originalEvent: Event;
}
