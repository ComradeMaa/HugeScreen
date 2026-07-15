import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainScreen } from './pages/MainScreen';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/screen" replace />} />
        <Route path="/screen" element={<MainScreen />} />
      </Routes>
    </BrowserRouter>
  );
}
