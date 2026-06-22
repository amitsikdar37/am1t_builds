import React, { useEffect, useState } from 'react';

const Loading = () => {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const sequence = [
      { text: "[INITIALIZING MATRIX PROTOCOLS...]", time: 100 },
      { text: "[ESTABLISHING CONNECTION TO GITHUB MAINFRAME...]", time: 600 },
      { text: "[FETCHING REPOSITORIES...]", time: 1100 },
      { text: "[PARSING COMMIT LOGS...]", time: 1600 },
      { text: "[JUDGING LIFE CHOICES...]", time: 2000 },
    ];

    sequence.forEach((item) => {
      setTimeout(() => {
        setLogs((prev) => [...prev, item.text]);
      }, item.time);
    });

  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <div className="w-full max-w-2xl bg-[#080B12] p-6 rounded border border-gray-800 shadow-[0_0_20px_rgba(16,185,129,0.1)] min-h-[300px]">
        {logs.map((log, index) => (
          <div key={index} className="text-toxicGreen font-mono text-sm md:text-base animate-matrix mb-2">
            &gt; {log}
          </div>
        ))}
        <div className="text-toxicGreen font-mono animate-blink mt-2">_</div>
      </div>
    </div>
  );
};

export default Loading;
