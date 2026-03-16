import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { promises as fs } from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS } from '@/lib/adminRbac';

const BACKUP_DIR = path.join(process.cwd(), 'backups');

async function ensureBackupDir() {
  await fs.mkdir(BACKUP_DIR, { recursive: true });
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_SETTINGS_READ);

    await ensureBackupDir();
    const entries = await fs.readdir(BACKUP_DIR);

    const items = await Promise.all(
      entries
        .filter((name) => name.endsWith('.sql') || name.endsWith('.dump'))
        .map(async (name) => {
          const fullPath = path.join(BACKUP_DIR, name);
          const stat = await fs.stat(fullPath);
          return {
            filename: name,
            sizeBytes: stat.size,
            createdAt: stat.mtime.toISOString(),
          };
        })
    );

    items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Admin backups list', error);
    return NextResponse.json({ error: 'Не вдалося завантажити список бекапів' }, { status: 500 });
  }
}

export async function POST(_request: NextRequest) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_SETTINGS_WRITE);

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return NextResponse.json({ error: 'DATABASE_URL не налаштований на сервері' }, { status: 500 });
    }

    await ensureBackupDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `onecompany-shop-${timestamp}.sql`;
    const fullPath = path.join(BACKUP_DIR, filename);

    const args = [databaseUrl, '-f', fullPath];

    return await new Promise<NextResponse>((resolve) => {
      const child = spawn('pg_dump', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stderr = '';
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('error', (error) => {
        console.error('pg_dump spawn error', error);
        resolve(
          NextResponse.json(
            { error: 'Не вдалося запустити pg_dump. Перевірте, що pg_dump встановлений на сервері.' },
            { status: 500 }
          )
        );
      });

      child.on('close', async (code) => {
        if (code !== 0) {
          console.error('pg_dump failed', { code, stderr });
          resolve(
            NextResponse.json(
              { error: 'pg_dump завершився з помилкою. Перевірте налаштування БД.', details: stderr },
              { status: 500 }
            )
          );
          return;
        }

        try {
          const stat = await fs.stat(fullPath);
          resolve(
            NextResponse.json({
              filename,
              sizeBytes: stat.size,
              createdAt: stat.mtime.toISOString(),
            })
          );
        } catch (statError) {
          console.error('backup stat error', statError);
          resolve(
            NextResponse.json(
              { error: 'Бекап створено, але не вдалося прочитати файл.', filename },
              { status: 500 }
            )
          );
        }
      });
    });
  } catch (error) {
    console.error('Admin backup create', error);
    return NextResponse.json({ error: 'Не вдалося створити бекап' }, { status: 500 });
  }
}

