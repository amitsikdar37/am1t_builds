const fs = require('fs');
const path = require('path');

const FALLBACK_VOICES = [
  {
    filename: "Abe Padhai Likhai me Dhyan Do, IAS YAS Bno - Munna bhaiya - Memes World (128k).mp3",
    url: "/voices/Abe%20Padhai%20Likhai%20me%20Dhyan%20Do%2C%20IAS%20YAS%20Bno%20-%20Munna%20bhaiya%20-%20Memes%20World%20%28128k%29.mp3",
    title: "Abe Padhai Likhai me Dhyan Do, IAS YAS Bno (Munna Bhaiya)"
  },
  {
    filename: "bade harami ho beta meme video - meme hub (128k).mp3",
    url: "/voices/bade%20harami%20ho%20beta%20meme%20video%20-%20meme%20hub%20%28128k%29.mp3",
    title: "Bade harami ho beta"
  },
  {
    filename: "Kyu nhi ho rahi padhai.mp3",
    url: "/voices/Kyu%20nhi%20ho%20rahi%20padhai.mp3",
    title: "Kyu nhi ho rahi padhai (Alakh Pandey)"
  },
  {
    filename: "Tum ek kaam karo IAS ki taiyaari chhod do .mp3",
    url: "/voices/Tum%20ek%20kaam%20karo%20IAS%20ki%20taiyaari%20chhod%20do%20.mp3",
    title: "Tum ek kaam karo IAS ki taiyaari chhod do (Vikas Sir)"
  }
];

module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  try {
    const voicesDir = path.join(process.cwd(), 'voices');
    if (fs.existsSync(voicesDir)) {
      const files = fs.readdirSync(voicesDir);
      const audioExtensions = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac']);
      
      const voices = files
        .filter(f => audioExtensions.has(path.extname(f).toLowerCase()))
        .map(filename => ({
          filename,
          url: `/voices/${encodeURIComponent(filename)}`,
          title: path.parse(filename).name
        }))
        .sort((a, b) => a.title.localeCompare(b.title));

      if (voices.length > 0) {
        return res.status(200).json({
          status: 'success',
          count: voices.length,
          voices
        });
      }
    }
  } catch (err) {
    console.warn('Vercel dynamic filesystem read failed, falling back to static list:', err);
  }

  // Fallback response ensures 100% uptime on serverless environments
  return res.status(200).json({
    status: 'success',
    count: FALLBACK_VOICES.length,
    voices: FALLBACK_VOICES
  });
};
