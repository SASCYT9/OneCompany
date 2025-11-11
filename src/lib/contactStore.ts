import { promises as fs } from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const FILE_PATH = path.join(DATA_DIR, 'contact-submissions.json');

export interface ContactSubmission {
  id: string;
  type: 'auto' | 'moto';
  name: string;
  email: string;
  subject: string;
  message: string;
  ip: string;
  createdAt: string;
}

async function ensure() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try { await fs.access(FILE_PATH); } catch { await fs.writeFile(FILE_PATH, '[]', 'utf8'); }
}

export async function appendSubmission(entry: Omit<ContactSubmission, 'id'|'createdAt'>) {
  await ensure();
  const raw = await fs.readFile(FILE_PATH, 'utf8');
  let arr: ContactSubmission[] = [];
  try { arr = JSON.parse(raw) as ContactSubmission[]; } catch { arr = []; }
  const record: ContactSubmission = {
    ...entry,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString()
  };
  arr.unshift(record);
  // Basic log rotation: keep only last 500 submissions
  if (arr.length > 500) arr = arr.slice(0, 500);
  await fs.writeFile(FILE_PATH, JSON.stringify(arr, null, 2), 'utf8');
  return record;
}

export async function listSubmissions(): Promise<ContactSubmission[]> {
  await ensure();
  const raw = await fs.readFile(FILE_PATH, 'utf8');
  try { return JSON.parse(raw) as ContactSubmission[]; } catch { return []; }
}
