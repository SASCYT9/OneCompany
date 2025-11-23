import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';

const main = async () => {
    const domain = 'brembo.com'; // Example domain
    console.log(`Testing Brandfetch for ${domain}...`);

    // Method 1: Direct Asset CDN
    // Brandfetch often exposes assets at https://asset.brandfetch.io/{domain}/logo
    // They might require an API key or specific headers, but sometimes it works for public access or via their embed logic.
    
    const assetTypes = ['logo', 'icon', 'symbol'];
    const formats = ['svg', 'png', 'jpeg'];

    for (const type of assetTypes) {
        const url = `https://asset.brandfetch.io/${domain}/${type}`;
        console.log(`Trying direct asset URL: ${url}`);
        try {
            const res = await axios.get(url, {
                responseType: 'arraybuffer',
                validateStatus: (status) => status < 500
            });
            
            if (res.status === 200) {
                const contentType = res.headers['content-type'];
                console.log(`✅ Success! Found ${type}. Content-Type: ${contentType}`);
                console.log(`Size: ${res.data.length} bytes`);
                
                // Save to check
                const ext = contentType.split('/')[1].split(';')[0] || 'bin';
                fs.writeFileSync(`brandfetch_test_${type}.${ext}`, res.data);
            } else {
                console.log(`❌ Failed ${type}: Status ${res.status}`);
            }
        } catch (e: any) {
            console.log(`❌ Error fetching ${type}: ${e.message}`);
        }
    }

    // Method 9: Brandfetch Search API
    const clientId = '1idyH0p6IxR3s4rkyyc';
    const searchApiUrl = `https://api.brandfetch.io/v2/search/${domain}`;
    console.log(`\nTesting Brandfetch Search API: ${searchApiUrl}`);
    try {
        const res = await axios.get(searchApiUrl, {
            headers: {
                'Authorization': `Bearer ${clientId}`,
                'User-Agent': 'OneCompany-Script/1.0'
            },
            validateStatus: (status) => status < 500
        });
        console.log(`Search API Status: ${res.status}`);
        if (res.status === 200) {
            console.log('✅ Search API Success!');
            const brands = res.data;
            if (brands.length > 0) {
                const brandId = brands[0].brandId;
                console.log(`Found Brand ID: ${brandId}`);
                
                // Step 2: Try CDN with Brand ID
                const cdnUrls = [
                    `https://cdn.brandfetch.io/${brandId}/theme/dark/logo.svg?c=${clientId}`,
                    `https://cdn.brandfetch.io/${brandId}/theme/light/logo.svg?c=${clientId}`,
                    `https://cdn.brandfetch.io/${brandId}/logo.svg?c=${clientId}`,
                    `https://asset.brandfetch.io/${brandId}/logo?c=${clientId}`
                ];

                console.log('\nTesting CDN with Brand ID:');
                for (const url of cdnUrls) {
                    console.log(`Fetching: ${url}`);
                    try {
                        const res = await axios.get(url, {
                            responseType: 'arraybuffer',
                            validateStatus: (status) => status < 500
                        });
                        console.log(`Status: ${res.status}`);
                        if (res.status === 200) {
                            console.log('✅ Success!');
                            const contentType = res.headers['content-type'];
                            console.log(`Content-Type: ${contentType}`);
                            const ext = contentType.split('/')[1].split(';')[0] || 'bin';
                            fs.writeFileSync(`brandfetch_id_cdn_${Date.now()}.${ext}`, res.data);
                        }
                    } catch (e: any) {
                        console.log(`Error: ${e.message}`);
                    }
                }
            }
        } else {
            console.log('Search API Error:', res.data);
        }
    } catch (e: any) {
        console.log(`Error Search API: ${e.message}`);
    }
};

main();
