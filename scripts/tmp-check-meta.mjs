import https from 'https';

const shortcodes = [
  'DW3qRqdDO4l',
  'DWzAIIoDHb4',
  'DWn0fWMjB1t',
  'DWlaTXVjBNO',
  'DWTU9BsDEJC',
  'DVG3S66DAgX'
];

async function checkPost(shortcode) {
  return new Promise((resolve) => {
    https.get(`https://www.instagram.com/p/${shortcode}/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const videoMatch = data.match(/<meta property="og:video" content="([^"]+)"/);
        const imgMatch = data.match(/<meta property="og:image" content="([^"]+)"/);
        resolve({
          shortcode,
          video: videoMatch ? videoMatch[1] : null,
          image: imgMatch ? imgMatch[1] : null,
          isReel: data.includes('"video_versions"') || data.includes('video/mp4')
        });
      });
    }).on('error', () => resolve({ shortcode, error: true }));
  });
}

async function run() {
  for (const code of shortcodes) {
    const res = await checkPost(code);
    console.log(res);
  }
}

run();
