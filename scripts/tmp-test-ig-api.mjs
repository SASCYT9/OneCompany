import https from 'https';

const shortcode = 'DWn0fWMjB1t'; // JB4
const url = `https://www.instagram.com/p/${shortcode}/?__a=1&__d=dis`;

https.get(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json'
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      if (data.includes('Login • Instagram')) {
        console.log('Redirected to login!');
      } else {
        const json = JSON.parse(data);
        console.log('Success! Keys:', Object.keys(json));
        if (json.graphql) console.log('Has graphql!');
        if (json.items) console.log('Has items!');
      }
    } catch(e) {
      console.log('Failed to parse:', e.message);
      console.log(data.slice(0, 200));
    }
  });
});
