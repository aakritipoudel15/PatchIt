import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/dashboard';
import LandingPage from './pages/landingpage';
import Location from './pages/user';
import { Home } from 'lucide-react';
import Homepage from './pages/homepage';


function App() {

  return (
    <>
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage/>}/>
          <Route path='/home' element={<Homepage/>}/>
        </Routes>
      </Router>
    </>
  );

}

export default App

