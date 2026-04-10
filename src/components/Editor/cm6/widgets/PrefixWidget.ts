import { WidgetType } from '@codemirror/view';

export class PrefixWidget extends WidgetType {
  constructor(
    private readonly text: string,
    private readonly className: string
  ) {
    super();
  }

  toDOM() {
    const span = document.createElement('span');
    span.className = this.className;
    span.textContent = this.text;
    return span;
  }

  eq(other: PrefixWidget) {
    return this.text === other.text && this.className === other.className;
  }
}
