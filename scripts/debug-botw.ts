import axios from 'axios';
import * as cheerio from 'cheerio';

const main = async () => {
    const brandName = 'brembo';
    const searchUrl = `https://www.brandsoftheworld.com/search/logo?search_api_views_fulltext=${brandName}`;
    console.log(`Searching ${searchUrl}...`);
    
    try {
        const res = await axios.get(searchUrl, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' 
            }
        });
        
        const $ = cheerio.load(res.data);
        console.log('Page Title:', $('title').text());
        
        // Find search results
        const results = $('ul.logos li');
        console.log(`Found ${results.length} results.`);
        
        results.each((i, el) => {
            if (i > 2) return; // Limit to first 3
            const link = $(el).find('a').attr('href');
            const title = $(el).find('.title').text().trim();
            const img = $(el).find('img').attr('src');
            console.log(`Result ${i+1}: ${title} - https://www.brandsoftheworld.com${link} (Img: ${img})`);
        });

    } catch (e: any) {
        console.error('Error:', e.message);
    }
};

main();
