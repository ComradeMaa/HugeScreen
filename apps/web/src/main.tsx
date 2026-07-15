import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerBuiltinWidgets } from '@hugescreen/widgets/registerWidgets';
import { registerHeaderElements } from '@hugescreen/widgets';
import { App } from './App';
import './index.css';

// 注册所有内置组件
registerBuiltinWidgets();
// 注册顶栏元素
registerHeaderElements();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
