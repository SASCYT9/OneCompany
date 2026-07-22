type OpsMediaResponseInput = {
  body: Uint8Array;
  fileName: string | null;
  mimeType: string;
  rangeHeader?: string | null;
};

function contentDisposition(fileName: string | null) {
  const safeName = String(fileName ?? "attachment")
    .replace(/[\r\n"]/gu, "")
    .slice(0, 180);
  return `inline; filename="${safeName || "attachment"}"`;
}

export function parseOpsMediaRange(rangeHeader: string | null | undefined, size: number) {
  if (!rangeHeader) return null;
  const match = /^bytes=(\d*)-(\d*)$/u.exec(rangeHeader.trim());
  if (!match || size <= 0) return undefined;

  const rawStart = match[1];
  const rawEnd = match[2];
  if (!rawStart && !rawEnd) return undefined;

  let start: number;
  let end: number;
  if (!rawStart) {
    const suffixLength = Number(rawEnd);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return undefined;
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd ? Number(rawEnd) : size - 1;
  }

  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    start >= size ||
    end < start
  ) {
    return undefined;
  }
  return { start, end: Math.min(end, size - 1) };
}

export function createOpsMediaResponse(input: OpsMediaResponseInput) {
  const size = input.body.byteLength;
  const range = parseOpsMediaRange(input.rangeHeader, size);
  const commonHeaders = {
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
    "Content-Disposition": contentDisposition(input.fileName),
    "Content-Type": input.mimeType,
    "X-Content-Type-Options": "nosniff",
  };

  if (range === undefined) {
    return new Response(null, {
      status: 416,
      headers: {
        ...commonHeaders,
        "Content-Range": `bytes */${size}`,
      },
    });
  }

  if (range) {
    const chunk = input.body.slice(range.start, range.end + 1);
    return new Response(Buffer.from(chunk), {
      status: 206,
      headers: {
        ...commonHeaders,
        "Content-Length": String(chunk.byteLength),
        "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
      },
    });
  }

  return new Response(Buffer.from(input.body), {
    status: 200,
    headers: {
      ...commonHeaders,
      "Content-Length": String(size),
    },
  });
}
