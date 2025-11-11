
import fs from 'fs/promises';
import path from 'path';
import axios, { AxiosInstance } from 'axios';

interface BrandListItem {
  name: string;
  domain?: string;
}

interface BrandfetchSearchResult {
  name?: string;
  domain?: string;
}

interface BrandfetchLogoFormat {
  format?: string;
  src?: string;
  fileType?: string;
  size?: number;
}

interface BrandfetchLogo {
  type?: string;
  theme?: string;
  formats?: BrandfetchLogoFormat[];
}

interface BrandfetchIcon {
  formats?: BrandfetchLogoFormat[];
}

interface BrandfetchBrandResponse {
  name?: string;
  domain?: string;
  logos?: BrandfetchLogo[];
  icon?: BrandfetchIcon;
}

const LOGO_DIR = path.join(process.cwd(), 'public', 'logos');
const BRAND_LOGOS_PATH = path.join(process.cwd(), 'src', 'lib', 'brandLogos.ts');
const BRAND_LIST_PATH = path.join(process.cwd(), 'scripts', 'brands-to-fetch.json');
const SUPPORTED_EXTENSIONS = ['.svg', '.png', '.webp', '.jpg', '.jpeg'];
const PREFERRED_FORMATS = ['svg', 'png', 'webp', 'jpg', 'jpeg'];
const BRANDFETCH_API_BASE_URL = 'https://api.brandfetch.io/v2';
const BRANDFETCH_API_KEY = process.env.BRANDFETCH_API_KEY;
const API_DELAY_MS = Number(process.env.BRANDFETCH_DELAY_MS ?? '400');
const MAX_RETRIES = 3;

if (!BRANDFETCH_API_KEY) {
  console.error('Missing BRANDFETCH_API_KEY environment variable.');
  process.exit(1);
}

const brandfetchClient: AxiosInstance = axios.create({
  baseURL: BRANDFETCH_API_BASE_URL,
  timeout: 15000,
  headers: {
    Authorization: `Bearer ${BRANDFETCH_API_KEY}`,
    Accept: 'application/json',
    'User-Agent': 'onecompany-logo-downloader/1.0',
  },
});

// Slugify function to create safe filenames
const slugify = (text: string) => {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const delayIfNeeded = async () => {
  if (API_DELAY_MS > 0) {
    await delay(API_DELAY_MS);
  }
};

const shouldRetryStatus = (status?: number) =>
  typeof status === 'number' && [429, 500, 502, 503, 504].includes(status);

const withRetry = async <T>(operation: () => Promise<T>, context: string, attempt = 1): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      if (attempt < MAX_RETRIES && shouldRetryStatus(status)) {
        const waitTime = API_DELAY_MS * (attempt + 1);
        console.warn(`Retrying ${context} after ${waitTime}ms (attempt ${attempt + 1}/${MAX_RETRIES}).`);
        await delay(waitTime);
        return withRetry(operation, context, attempt + 1);
      }
      console.error(`Brandfetch request failed for ${context}: ${status ?? error.message}`);
    } else if (error instanceof Error) {
      console.error(`Unexpected error in ${context}: ${error.message}`);
    } else {
      console.error(`Unknown error in ${context}:`, error);
    }
    throw error;
  }
};

const readBrandList = async (): Promise<BrandListItem[]> => {
  try {
    const raw = await fs.readFile(BRAND_LIST_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as BrandListItem[];
    return parsed
      .filter((item): item is BrandListItem => typeof item?.name === 'string' && item.name.trim().length > 0)
      .map(item => ({
        name: item.name.trim(),
        domain: item.domain?.trim(),
      }));
  } catch (error) {
    console.error(`Unable to read brand list at ${BRAND_LIST_PATH}:`, error);
    throw error;
  }
};

const findExistingLogo = async (slug: string): Promise<string | null> => {
  for (const extension of SUPPORTED_EXTENSIONS) {
    const candidate = `${slug}${extension}`;
    try {
      await fs.access(path.join(LOGO_DIR, candidate));
      return candidate;
    } catch {
      // Continue checking other extensions
    }
  }
  return null;
};

const extractAssetFromFormats = (formats?: BrandfetchLogoFormat[]) => {
  if (!formats?.length) {
    return null;
  }

  for (const preferred of PREFERRED_FORMATS) {
    const candidate = formats.find(format => (format.format ?? format.fileType)?.toLowerCase() === preferred && format.src);
    if (candidate?.src) {
      const normalizedFormat = preferred === 'jpeg' ? 'jpg' : preferred;
      return { url: candidate.src, extension: `.${normalizedFormat}` };
    }
  }

  const fallback = formats.find(format => Boolean(format.src));
  if (fallback?.src) {
    const fallbackFormat = (fallback.format ?? fallback.fileType ?? 'png').toLowerCase();
    const normalizedFormat = fallbackFormat === 'jpeg' ? 'jpg' : fallbackFormat;
    return { url: fallback.src, extension: `.${normalizedFormat}` };
  }

  return null;
};

const selectLogoAsset = (brand: BrandfetchBrandResponse) => {
  for (const logo of brand.logos ?? []) {
    const asset = extractAssetFromFormats(logo.formats);
    if (asset) {
      return asset;
    }
  }

  if (brand.icon) {
    const asset = extractAssetFromFormats(brand.icon.formats);
    if (asset) {
      return asset;
    }
  }

  return null;
};

const searchBrandDomain = async (brand: BrandListItem): Promise<string | null> => {
  if (brand.domain) {
    return brand.domain;
  }

  try {
    const response = await withRetry(
      () => brandfetchClient.get<BrandfetchSearchResult[]>(`/search/${encodeURIComponent(brand.name)}`),
      `Brandfetch search for "${brand.name}"`
    );
    const results = Array.isArray(response.data) ? response.data : [];
    if (!results.length) {
      return null;
    }
    const normalized = brand.name.trim().toLowerCase();
    const exact = results.find(result => result.name?.trim().toLowerCase() === normalized);
    return (exact ?? results[0])?.domain ?? null;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null;
    }
    throw error;
  }
};

const fetchBrandDetails = async (domain: string): Promise<BrandfetchBrandResponse | null> => {
  try {
    const response = await withRetry(
      () => brandfetchClient.get<BrandfetchBrandResponse>(`/brands/${encodeURIComponent(domain)}`),
      `Brandfetch brand lookup for "${domain}"`
    );
    return response.data ?? null;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null;
    }
    throw error;
  }
};

const downloadImage = async (url: string, filepath: string): Promise<boolean> => {
  try {
    const response = await axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: {
        'User-Agent': 'onecompany-logo-downloader/1.0',
      },
    });

    const buffer = Buffer.from(response.data);
    if (response.status === 200 && buffer.length > 0) {
      await fs.writeFile(filepath, buffer);
      console.log(`Downloaded logo to ${path.basename(filepath)}`);
      return true;
    }

    console.warn(`Unexpected response when downloading ${url}: status ${response.status}`);
    return false;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.error(`Error downloading ${url}: Status ${error.response.status}`);
    } else if (error instanceof Error) {
      console.error(`Error downloading ${url}: ${error.message}`);
    } else {
      console.error(`Unknown error downloading ${url}:`, error);
    }
    return false;
  }
};

const main = async () => {
  try {
    await fs.mkdir(LOGO_DIR, { recursive: true });
    console.log(`Logo directory is ready at: ${LOGO_DIR}`);

    const brands = await readBrandList();
    console.log(`Processing ${brands.length} brands from ${BRAND_LIST_PATH}`);

    if (!brands.length) {
      console.warn(`No brands found in ${BRAND_LIST_PATH}.`);
      return;
    }

    const logoMap: Record<string, string> = {};
    const missingBrands: string[] = [];
    const failedBrands: string[] = [];
    const reusedBrands: string[] = [];
    let downloadedCount = 0;

    for (const brand of brands) {
      const brandName = brand.name.trim();
      const slug = slugify(brandName);

      const existingLogo = await findExistingLogo(slug);
      if (existingLogo) {
        logoMap[brandName] = `/logos/${existingLogo}`;
        reusedBrands.push(brandName);
        continue;
      }

      let domain: string | null = null;
      try {
        domain = await searchBrandDomain(brand);
      } catch (error) {
        console.error(`Brandfetch search failed for ${brandName}:`, error instanceof Error ? error.message : error);
        failedBrands.push(brandName);
        await delayIfNeeded();
        continue;
      }

      if (!brand.domain) {
        await delayIfNeeded();
      }

      if (!domain) {
        console.warn(`No Brandfetch match found for ${brandName}.`);
        missingBrands.push(brandName);
        continue;
      }

      let brandDetails: BrandfetchBrandResponse | null = null;
      try {
        brandDetails = await fetchBrandDetails(domain);
      } catch (error) {
        console.error(`Brandfetch lookup failed for ${brandName} (${domain}):`, error instanceof Error ? error.message : error);
        failedBrands.push(brandName);
        await delayIfNeeded();
        continue;
      }

      await delayIfNeeded();

      if (!brandDetails) {
        console.warn(`Brandfetch returned no data for ${brandName} (${domain}).`);
        missingBrands.push(brandName);
        continue;
      }

      const asset = selectLogoAsset(brandDetails);
      if (!asset) {
        console.warn(`No downloadable logo asset found for ${brandName} (${domain}).`);
        missingBrands.push(brandName);
        continue;
      }

      const fileName = `${slug}${asset.extension}`;
      const filePath = path.join(LOGO_DIR, fileName);

      const downloaded = await downloadImage(asset.url, filePath);
      if (downloaded) {
        downloadedCount += 1;
        logoMap[brandName] = `/logos/${fileName}`;
      } else {
        failedBrands.push(brandName);
      }
    }

    const totalMapped = Object.keys(logoMap).length;

    console.log(`\nDownloaded ${downloadedCount} new logos.`);
    if (reusedBrands.length) {
      console.log(`Reused ${reusedBrands.length} existing logos.`);
    }
    if (missingBrands.length) {
      console.warn(`No logo found for ${missingBrands.length} brands.`);
    }
    if (failedBrands.length) {
      console.warn(`Failed to download logos for ${failedBrands.length} brands.`);
    }

    if (!totalMapped) {
      console.warn('No logos available to write to src/lib/brandLogos.ts.');
      return;
    }

    let fileContent = `// This file is auto-generated by scripts/download-logos.ts\n\n`;
    fileContent += `export const BRAND_LOGO_MAP: Record<string, string> = {\n`;
    for (const [brandName, logoPath] of Object.entries(logoMap).sort((a, b) => a[0].localeCompare(b[0]))) {
      fileContent += `  '${brandName.replace(/'/g, "\\'")}': '${logoPath}',\n`;
    }
    fileContent += `};\n\n`;
    fileContent += `export const getBrandLogo = (brandName: string): string => {\n`;
    fileContent += `  return BRAND_LOGO_MAP[brandName] || '/logos/placeholder.svg';\n`;
    fileContent += `};\n`;

    await fs.writeFile(BRAND_LOGOS_PATH, fileContent, 'utf-8');
    console.log(`\nSuccessfully updated brand logo map at: ${BRAND_LOGOS_PATH}`);

    if (missingBrands.length || failedBrands.length) {
      console.log('\nReview logs for brands requiring manual follow-up.');
    }
  } catch (error) {
    console.error('\nAn error occurred during the script execution:', error);
    process.exit(1);
  }
};

main();
