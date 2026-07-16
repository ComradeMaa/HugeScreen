import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerBuiltinWidgets } from '@hugescreen/widgets/registerWidgets';
import { registerHeaderElements } from '@hugescreen/widgets';
import { ViewerScreen } from './pages/ViewerScreen';
import './index.css';

// 注册所有内置组件
registerBuiltinWidgets();
registerHeaderElements();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ViewerScreen />
  </React.StrictMode>,
);
