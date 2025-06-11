import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import BoundaryLayerAnalysis from './pages/BoundaryLayerAnalysis';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/boundary-layer" element={<BoundaryLayerAnalysis />} />
      </Routes>
    </Router>
  );
}

export default App;
