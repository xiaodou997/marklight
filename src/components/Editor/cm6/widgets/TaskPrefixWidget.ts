import { WidgetType } from '@codemirror/view';

/** 渲染任务列表前缀为真实的 checkbox 元素 */
export class TaskPrefixWidget extends WidgetType {
  constructor(private readonly checked: boolean) {
    super();
  }

  toDOM() {
    const label = document.createElement('label');
    label.className = 'mk-task-label';
    label.dataset.taskToggle = '1';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'mk-task-checkbox';
    input.checked = this.checked;
    input.tabIndex = -1;

    label.appendChild(input);
    return label;
  }

  eq(other: TaskPrefixWidget) {
    return this.checked === other.checked;
  }
}
