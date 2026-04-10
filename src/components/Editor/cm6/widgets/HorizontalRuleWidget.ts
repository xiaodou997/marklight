import { WidgetType } from '@codemirror/view';

export class HorizontalRuleWidget extends WidgetType {
  toDOM() {
    const hr = document.createElement('span');
    hr.className = 'mk-hr-widget';
    return hr;
  }

  eq() {
    return true;
  }
}
