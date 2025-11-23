import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';

const main = async () => {
    const url = 'https://www.brandsoftheworld.com/logo/brembo-0';
    console.log(`Fetching ${url}...`);
    
    try {
        const res = await axios.get(url, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' 
            }
        });
        
        fs.writeFileSync('botw_dump.html', res.data);
        console.log('Dumped HTML to botw_dump.html');

    } catch (e: any) {
        console.error('Error:', e.message);
    }
};

main();
