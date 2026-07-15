import { headerElementRegistry } from './header-elements';
import { HeaderTitle } from './header-elements/HeaderTitle';
import { HeaderDateTime } from './header-elements/HeaderDateTime';

export function registerHeaderElements(): void {
  headerElementRegistry.register({
    type: 'header-title',
    name: '标题',
    icon: 'Type',
    defaultColSpan: 2,
    component: HeaderTitle,
    defaultConfig: { text: '数据监控中心' },
  });

  headerElementRegistry.register({
    type: 'header-datetime',
    name: '日期时间',
    icon: 'Clock',
    defaultColSpan: 1,
    component: HeaderDateTime,
    defaultConfig: { showSeconds: true },
  });

  console.log(
    `[HeaderElements] ${headerElementRegistry.getAll().length} header elements ready.`,
  );
}
