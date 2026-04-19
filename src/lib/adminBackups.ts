export type AdminBackupRuntimePolicyInput = {
  nodeEnv?: string;
  databaseUrl?: string;
};

export type AdminPgDumpInvocationInput = {
  databaseUrl: string;
  outputPath: string;
};

export function getAdminBackupRuntimePolicy(input: AdminBackupRuntimePolicyInput) {
  const nodeEnv = String(input.nodeEnv ?? '').trim().toLowerCase();
  const databaseUrl = String(input.databaseUrl ?? '').trim();

  if (nodeEnv === 'production') {
    return {
      allowed: false as const,
      status: 503,
      error: 'Production backups must run through external backup automation.',
    };
  }

  if (!databaseUrl) {
    return {
      allowed: false as const,
      status: 500,
      error: 'DATABASE_URL is not configured on the server.',
    };
  }

  return {
    allowed: true as const,
    status: 200,
  };
}

export function buildAdminPgDumpInvocation(input: AdminPgDumpInvocationInput) {
  const url = new URL(input.databaseUrl);
  const databaseName = url.pathname.replace(/^\//, '');
  const username = decodeURIComponent(url.username || '');
  const password = decodeURIComponent(url.password || '');
  const sslMode = url.searchParams.get('sslmode');

  return {
    args: [
      '--file',
      input.outputPath,
      '--format=plain',
      '--no-owner',
      '--no-privileges',
      '--host',
      url.hostname,
      '--port',
      url.port || '5432',
      '--username',
      username,
      '--dbname',
      databaseName,
    ],
    env: {
      ...(password ? { PGPASSWORD: password } : {}),
      ...(sslMode ? { PGSSLMODE: sslMode } : {}),
    },
  };
}
