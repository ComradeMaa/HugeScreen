import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerBuiltinWidgets } from '@hugescreen/widgets/registerWidgets';
import { App } from './App';
import './index.css';

// 注册所有内置组件
registerBuiltinWidgets();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
