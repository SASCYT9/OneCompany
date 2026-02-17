#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import https from "node:https";

const PROFILE = "onecompany.global";
const PROFILE_URL = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${PROFILE}`;
const BLOG_IMAGE_DIR = path.resolve("public/images/blog");
const BLOG_VIDEO_DIR = path.resolve("public/videos/blog");
const CONTENT_PATH = path.resolve("public/config/site-content.json");
const REPORT_PATH = path.resolve("scripts/ig-latest-sync.json");
const MAX_POSTS = Number.parseInt(process.env.IG_MAX_POSTS || "16", 10);
const EXCLUDED_SHORTCODES = new Set(
  (process.env.IG_EXCLUDE_SHORTCODES || "DTSKMDMJFGF")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean)
);

function requestJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: "GET",
        headers: {
          "user-agent": "Mozilla/5.0",
          ...headers,
        },
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode} for ${url}`));
            return;
          }
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(new Error(`Invalid JSON from ${url}: ${error.message}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { "user-agent": "Mozilla/5.0", referer: "https://www.instagram.com/" } },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed ${res.statusCode}: ${url}`));
          return;
        }
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", async () => {
          try {
            const buffer = Buffer.concat(chunks);
            await fs.writeFile(destPath, buffer);
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      }
    );
    req.on("error", reject);
  });
}

async function translateText(text, targetLanguage) {
  const normalized = text.trim();
  if (!normalized) return "";
  const url =
    "https://translate.googleapis.com/translate_a/single" +
    `?client=gtx&sl=auto&tl=${targetLanguage}&dt=t&q=${encodeURIComponent(normalized)}`;
  const payload = await requestJson(url);
  const translated = Array.isArray(payload?.[0])
    ? payload[0].map((chunk) => chunk?.[0] || "").join("")
    : "";
  return translated.trim() || normalized;
}

function cleanCaption(value) {
  return value.replace(/\r/g, "").replace(/\u00a0/g, " ").replace(/[ \t]+\n/g, "\n").trim();
}

function collapseWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function trimWithEllipsis(value, max = 72) {
  const normalized = collapseWhitespace(value);
  if (normalized.length <= max) {
    return normalized;
  }
  const shortened = normalized.slice(0, max);
  const safeCut = shortened.includes(" ")
    ? shortened.slice(0, shortened.lastIndexOf(" "))
    : shortened;
  return `${safeCut.trimEnd()}…`;
}

function stripCaptionNoise(value) {
  const withoutLinks = value.replace(/https?:\/\/\S+/gi, " ");
  const withoutTags = withoutLinks.replace(/#([\p{L}\p{N}_]+)/gu, " ");
  const withoutLeadingJunk = withoutTags.replace(/^[^0-9A-Za-zА-Яа-яІіЇїЄєҐґ]+/u, "");
  return collapseWhitespace(withoutLeadingJunk)
    .replace(/[:\-–—•|]+$/u, "")
    .trim();
}

function pickTitleSeed(caption, fallback) {
  const lines = caption
    .split("\n")
    .map((line) => stripCaptionNoise(line))
    .filter(Boolean);

  const textLines = lines.filter((line) => /[A-Za-zА-Яа-яІіЇїЄєҐґ]/u.test(line));
  if (textLines.length === 0) {
    return fallback;
  }

  const first = textLines[0];
  if ((first.length < 28 || /[:\-–—]$/u.test(first)) && textLines[1]) {
    return `${first.replace(/[:\-–—]+$/u, "").trim()} ${textLines[1]}`.trim();
  }

  return first;
}

function isLikelyUkrainian(text) {
  const normalized = text.toLowerCase();
  return /[іїєґ]/.test(normalized) || /[а-я]/.test(normalized);
}

function makeTitleFromCaption(caption, fallback) {
  const seed = pickTitleSeed(caption, fallback);
  const firstSentence = seed.split(/[.!?](?:\s|$)/u)[0] || seed;
  const compact = collapseWhitespace(firstSentence);
  if (!compact) return fallback;
  return trimWithEllipsis(compact, 92);
}

const SLUG_STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "to",
  "for",
  "of",
  "in",
  "on",
  "with",
  "at",
  "is",
  "are",
  "you",
  "your",
  "this",
  "that",
]);

function slugify(value, shortcode) {
  const tokens = value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !SLUG_STOP_WORDS.has(token));

  const picked = [];
  let totalLength = 0;
  for (const token of tokens) {
    if (picked.length >= 8) break;
    const nextLength = totalLength + token.length + (picked.length ? 1 : 0);
    if (nextLength > 52) break;
    picked.push(token);
    totalLength = nextLength;
  }

  const base = picked.join("-") || "instagram-post";
  return `${base}-${shortcode.toLowerCase()}`;
}

function extractHashtags(text) {
  const matches = text.match(/#([\p{L}\p{N}_]+)/gu) || [];
  const tags = [...new Set(matches.map((item) => item.slice(1).toLowerCase()))];
  return tags.slice(0, 12);
}

function extractShortcodeFromPost(post) {
  const fromId = String(post?.id || "").match(/^ig-([a-z0-9_-]{6,})$/i);
  if (fromId) {
    return fromId[1].toUpperCase();
  }

  const candidates = Array.isArray(post?.media)
    ? post.media.flatMap((media) => [media?.src, media?.poster]).filter(Boolean)
    : [];
  for (const candidate of candidates) {
    const filename = String(candidate).split("?")[0].split("/").pop() || "";
    const basename = filename.replace(/\.(jpg|jpeg|png|webp|mp4|webm|mov)$/i, "");
    const normalized = basename.replace(/-\d+$/, "");
    if (/^[a-z0-9_-]{6,}$/i.test(normalized)) {
      return normalized.toUpperCase();
    }
  }

  return null;
}

function fileExtensionFromUrl(url, fallback) {
  try {
    const ext = path.extname(new URL(url).pathname).toLowerCase();
    if (!ext) return fallback;
    if (/^\.[a-z0-9]{2,5}$/.test(ext)) return ext;
    return fallback;
  } catch {
    return fallback;
  }
}

function mediaFileSuffix(index) {
  return index === null ? "" : `-${index + 1}`;
}

function isGenericBrandTitle(value) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-zа-яіїєґ0-9\s]+/giu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized === "one company" || normalized === "onecompany";
}

async function buildMediaForNode(node, shortcode, enTitle) {
  const media = [];

  const createImageMedia = async (displayUrl, index = null) => {
    if (!displayUrl) return null;
    const suffix = mediaFileSuffix(index);
    const imageFilename = `${shortcode}${suffix}.jpg`;
    const imagePath = path.join(BLOG_IMAGE_DIR, imageFilename);
    await downloadFile(displayUrl, imagePath);
    return {
      id: `media-ig-${shortcode.toLowerCase()}${suffix || ""}`,
      type: "image",
      src: `/images/blog/${imageFilename}`,
      alt: enTitle,
    };
  };

  const createVideoMedia = async (videoUrl, displayUrl, index = null) => {
    if (!videoUrl) return null;
    const suffix = mediaFileSuffix(index);
    const videoExt = fileExtensionFromUrl(videoUrl, ".mp4");
    const videoFilename = `${shortcode}${suffix}${videoExt}`;
    const videoPath = path.join(BLOG_VIDEO_DIR, videoFilename);
    await downloadFile(videoUrl, videoPath);

    let posterSrc;
    if (displayUrl) {
      try {
        const posterFilename = `${shortcode}${suffix}.jpg`;
        const posterPath = path.join(BLOG_IMAGE_DIR, posterFilename);
        await downloadFile(displayUrl, posterPath);
        posterSrc = `/images/blog/${posterFilename}`;
      } catch {
        posterSrc = undefined;
      }
    }

    return {
      id: `media-ig-${shortcode.toLowerCase()}${suffix || ""}`,
      type: "video",
      src: `/videos/blog/${videoFilename}`,
      poster: posterSrc,
      alt: enTitle,
    };
  };

  const sidecar = node?.edge_sidecar_to_children?.edges || [];
  if (Array.isArray(sidecar) && sidecar.length > 0) {
    for (let i = 0; i < sidecar.length; i += 1) {
      const child = sidecar[i]?.node;
      if (!child) continue;
      if (child.is_video && child.video_url) {
        try {
          const item = await createVideoMedia(child.video_url, child.display_url, i);
          if (item) media.push(item);
        } catch {
          const fallbackItem = await createImageMedia(child.display_url, i);
          if (fallbackItem) media.push(fallbackItem);
        }
        continue;
      }
      const item = await createImageMedia(child.display_url, i);
      if (item) media.push(item);
    }
    return media;
  }

  if (node?.is_video && node?.video_url) {
    try {
      const videoItem = await createVideoMedia(node.video_url, node.display_url, null);
      if (videoItem) media.push(videoItem);
    } catch {
      const fallbackItem = await createImageMedia(node?.display_url, null);
      if (fallbackItem) media.push(fallbackItem);
    }
    return media;
  }

  const imageItem = await createImageMedia(node?.display_url, null);
  if (imageItem) media.push(imageItem);
  return media;
}

async function main() {
  await fs.mkdir(BLOG_IMAGE_DIR, { recursive: true });
  await fs.mkdir(BLOG_VIDEO_DIR, { recursive: true });

  const response = await requestJson(PROFILE_URL, {
    "x-ig-app-id": "936619743392459",
  });

  const edges = response?.data?.user?.edge_owner_to_timeline_media?.edges || [];
  const sortedEdges = [...edges]
    .sort((a, b) => (b?.node?.taken_at_timestamp || 0) - (a?.node?.taken_at_timestamp || 0))
    .slice(0, MAX_POSTS);

  const rawContent = await fs.readFile(CONTENT_PATH, "utf8");
  const content = JSON.parse(rawContent);
  const rawExistingPosts = Array.isArray(content?.blog?.posts) ? content.blog.posts : [];
  const dedupedExisting = [];
  const seenExistingShortcodes = new Set();
  for (const post of rawExistingPosts) {
    const shortcode = extractShortcodeFromPost(post);
    if (shortcode && seenExistingShortcodes.has(shortcode)) {
      continue;
    }
    if (shortcode) {
      seenExistingShortcodes.add(shortcode);
    }
    dedupedExisting.push(post);
  }

  const postsByShortcode = new Map();
  for (const post of dedupedExisting) {
    const shortcode = extractShortcodeFromPost(post);
    if (shortcode) {
      postsByShortcode.set(shortcode, post);
    }
  }
  for (const excluded of EXCLUDED_SHORTCODES) {
    postsByShortcode.delete(excluded);
  }

  const imported = [];

  for (const edge of sortedEdges) {
    try {
      const node = edge?.node;
      if (!node) continue;

      const shortcode = String(node.shortcode || "").toUpperCase();
      if (!shortcode) {
        continue;
      }
      if (EXCLUDED_SHORTCODES.has(shortcode)) {
        continue;
      }

      const rawCaption = node?.edge_media_to_caption?.edges?.[0]?.node?.text || "";
      const uaCaptionCandidate = cleanCaption(rawCaption);
      const uaCaption = isLikelyUkrainian(uaCaptionCandidate)
        ? uaCaptionCandidate
        : await translateText(uaCaptionCandidate, "uk");
      const enCaption = await translateText(uaCaptionCandidate, "en");

      const uaTitle = makeTitleFromCaption(uaCaption, `Instagram post ${shortcode}`);
      const enTitleSource = makeTitleFromCaption(enCaption, `Instagram post ${shortcode}`);
      const enTitle = collapseWhitespace(enTitleSource);
      if (isGenericBrandTitle(uaTitle) && isGenericBrandTitle(enTitle)) {
        continue;
      }
      const existing = postsByShortcode.get(shortcode);
      const slug = existing?.slug || slugify(enTitle, shortcode);

      const media = await buildMediaForNode(node, shortcode, enTitle);
      if (!media.length) {
        continue;
      }

      const post = {
        id: `ig-${shortcode.toLowerCase()}`,
        slug,
        title: {
          ua: uaTitle,
          en: enTitle,
        },
        caption: {
          ua: uaCaption,
          en: enCaption,
        },
        date: new Date((node.taken_at_timestamp || 0) * 1000).toISOString(),
        location: {
          ua: "Україна",
          en: "Ukraine",
        },
        tags: extractHashtags(uaCaptionCandidate),
        status: "published",
        media,
      };

      postsByShortcode.set(shortcode, post);

      imported.push({
        shortcode,
        action: existing ? "updated" : "added",
        slug,
        date: post.date,
        media: media.map((item) => item.type),
      });
    } catch (error) {
      console.warn(`Skipped post due to sync error: ${error.message}`);
    }
  }

  const withoutShortcodePosts = dedupedExisting.filter((post) => !extractShortcodeFromPost(post));
  content.blog.posts = [...postsByShortcode.values(), ...withoutShortcodePosts].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  await fs.writeFile(CONTENT_PATH, JSON.stringify(content, null, 2));
  await fs.writeFile(
    REPORT_PATH,
    JSON.stringify(
      {
        profile: PROFILE,
        requestedAt: new Date().toISOString(),
        importedCount: imported.length,
        imported,
      },
      null,
      2
    )
  );

  console.log(`Imported ${imported.length} posts from @${PROFILE}`);
  for (const item of imported) {
    console.log(`- ${item.shortcode} -> ${item.slug}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
