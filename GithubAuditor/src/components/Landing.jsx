import React, { useState } from 'react';

const Landing = ({ onAudit, error }) => {
  const [username, setUsername] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username.trim()) {
      onAudit(username.trim());
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
      <h1 className="text-4xl md:text-6xl font-bold mb-4 tracking-tighter shadow-sm">
        <span className="text-white">GitHub</span> <span className="text-toxicGreen">Profile</span> <span className="text-cyberRed animate-pulse">Auditor</span>
      </h1>
      <p className="text-gray-400 mb-8 max-w-md">
        Enter a GitHub username to brutally analyze their coding habits, tutorial reliance, and chaotic commits.
      </p>
      
      <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-4">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter GitHub Username"
          className="w-full p-4 bg-slateBase border border-gray-700 text-white rounded-md focus:outline-none focus:border-toxicGreen focus:ring-1 focus:ring-toxicGreen transition-colors font-mono"
        />
        <button
          type="submit"
          disabled={!username.trim()}
          className="w-full p-4 bg-toxicGreen text-slateBase font-bold rounded-md hover:bg-emerald-400 hover:shadow-[0_0_15px_rgba(16,185,129,0.5)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          [ AUDIT PROFILE ]
        </button>
      </form>
      
      {error && (
        <div className="mt-6 text-cyberRed bg-cyberRed/10 border border-cyberRed/30 p-4 rounded max-w-md w-full">
          {error === 'RATE_LIMIT' && "GITHUB API RATE LIMIT EXCEEDED. TRY AGAIN IN AN HOUR OR GO OUTSIDE."}
          {error === 'NOT_FOUND' && "USER NOT FOUND. DID THEY DELETE THEIR ACCOUNT IN SHAME?"}
          {error === 'API_ERROR' && "AN ERROR OCCURRED WHILE FETCHING THE MAINFRAME."}
        </div>
      )}
    </div>
  );
};

export default Landing;
