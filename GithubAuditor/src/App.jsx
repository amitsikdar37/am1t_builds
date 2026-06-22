import React, { useState } from 'react';
import Landing from './components/Landing';
import Loading from './components/Loading';
import Dashboard from './components/Dashboard';
import { fetchGithubData } from './utils/githubApi';

function App() {
  const [appState, setAppState] = useState('LANDING'); // LANDING, LOADING, DASHBOARD
  const [githubData, setGithubData] = useState(null);
  const [error, setError] = useState(null);

  const handleAudit = async (username) => {
    setError(null);
    setAppState('LOADING');
    
    // We want the loading screen to show for at least 2.5 seconds for "theater"
    const minimumDelay = new Promise(resolve => setTimeout(resolve, 2500));
    
    try {
      const [data] = await Promise.all([fetchGithubData(username), minimumDelay]);
      setGithubData(data);
      setAppState('DASHBOARD');
    } catch (err) {
      await minimumDelay;
      setError(err.message || 'API_ERROR');
      setAppState('LANDING');
    }
  };

  const handleReset = () => {
    setAppState('LANDING');
    setGithubData(null);
    setError(null);
  };

  return (
    <div className="bg-slateBase min-h-screen text-gray-200 font-mono">
      {appState === 'LANDING' && <Landing onAudit={handleAudit} error={error} />}
      {appState === 'LOADING' && <Loading />}
      {appState === 'DASHBOARD' && githubData && <Dashboard data={githubData} onReset={handleReset} />}
    </div>
  );
}

export default App;
