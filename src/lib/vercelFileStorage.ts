export const isVercelRuntime = process.env.VERCEL === '1' || process.env.VERCEL === 'true';

export const VERCEL_FILE_STORAGE_MESSAGE =
  'This endpoint depends on local filesystem storage and is disabled on Vercel. Use external object storage or run the workflow locally.';
