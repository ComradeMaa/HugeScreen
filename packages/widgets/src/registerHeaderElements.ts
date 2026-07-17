import { headerElementRegistry } from './header-elements';
import { HeaderTitle } from './header-elements/HeaderTitle';
import { HeaderDateTime } from './header-elements/HeaderDateTime';
import { MiniGlobe } from './header-elements/MiniGlobe';

export function registerHeaderElements(): void {
  headerElementRegistry.register({
    type: 'header-title',
    name: '标题',
    icon: 'Type',
    defaultColSpan: 2,
    component: HeaderTitle,
    defaultConfig: {
      text: '数据监控中心',
      fontSize: '16px',
      fontWeight: '600',
      fontStyle: 'normal',
      color: '#ffffff',
      textAlign: 'left',
    },
  });

  headerElementRegistry.register({
    type: 'header-datetime',
    name: '日期时间',
    icon: 'Clock',
    defaultColSpan: 1,
    component: HeaderDateTime,
    defaultConfig: { showSeconds: true },
  });

  headerElementRegistry.register({
    type: 'mini-globe',
    name: '迷你地球',
    icon: 'Globe',
    defaultColSpan: 1,
    component: MiniGlobe,
    defaultConfig: {},
  });

  console.log(
    `[HeaderElements] ${headerElementRegistry.getAll().length} header elements ready.`,
  );
}
