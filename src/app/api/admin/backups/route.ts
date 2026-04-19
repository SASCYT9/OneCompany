import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { promises as fs } from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from '@/lib/adminRbac';
import { prisma } from '@/lib/prisma';
import { buildAdminPgDumpInvocation, getAdminBackupRuntimePolicy, pruneLocalBackupFiles } from '@/lib/adminBackups';

const BACKUP_DIR = path.join(process.cwd(), 'backups');

async function ensureBackupDir() {
  await fs.mkdir(BACKUP_DIR, { recursive: true });
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_SETTINGS_READ);

    if (String(process.env.NODE_ENV ?? '').trim().toLowerCase() === 'production') {
      return NextResponse.json({
        items: [],
        managedExternally: true,
        message: 'Production backups are managed through external backup automation.',
      });
    }

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
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin backups list', error);
    return NextResponse.json({ error: 'Не вдалося завантажити список бекапів' }, { status: 500 });
  }
}

export async function POST(_request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_SETTINGS_WRITE);

    const databaseUrl = process.env.DATABASE_URL;
    const runtimePolicy = getAdminBackupRuntimePolicy({
      nodeEnv: process.env.NODE_ENV,
      databaseUrl,
    });
    if (!runtimePolicy.allowed) {
      return NextResponse.json({ error: runtimePolicy.error }, { status: runtimePolicy.status });
    }

    await ensureBackupDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `onecompany-shop-${timestamp}.sql`;
    const fullPath = path.join(BACKUP_DIR, filename);
    const invocation = buildAdminPgDumpInvocation({
      databaseUrl: databaseUrl!,
      outputPath: fullPath,
    });

    return await new Promise<NextResponse>((resolve) => {
      const child = spawn('pg_dump', invocation.args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          ...invocation.env,
        },
      });

      child.stderr.on('data', (chunk) => {
        void chunk;
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
          console.error('pg_dump failed', { code });
          resolve(
            NextResponse.json(
              { error: 'pg_dump завершився з помилкою. Перевірте доступність БД та зовнішню backup automation.' },
              { status: 500 }
            )
          );
          return;
        }

        try {
          const stat = await fs.stat(fullPath);
          const retention = Math.max(1, parseInt(process.env.ADMIN_LOCAL_BACKUP_RETENTION || '10', 10));
          await pruneLocalBackupFiles(BACKUP_DIR, retention);
          try {
            await writeAdminAuditLog(prisma, session, {
              scope: 'backups',
              action: 'backup.create',
              entityType: 'system.backup',
              entityId: filename,
              metadata: {
                filename,
                sizeBytes: stat.size,
              },
            });
          } catch (auditError) {
            console.error('Failed to write backup audit log', auditError);
          }
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
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin backup create', error);
    return NextResponse.json({ error: 'Не вдалося створити бекап' }, { status: 500 });
  }
}

