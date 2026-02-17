#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import https from "node:https";

const PROFILE = "onecompany.global";
const PROFILE_URL = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${PROFILE}`;
const BLOG_IMAGE_DIR = path.resolve("public/images/blog");
const CONTENT_PATH = path.resolve("public/config/site-content.json");
const REPORT_PATH = path.resolve("scripts/ig-latest-sync.json");
const MAX_POSTS = Number.parseInt(process.env.IG_MAX_POSTS || "8", 10);

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
          reject(new Error(`Image download failed ${res.statusCode}: ${url}`));
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

function isLikelyUkrainian(text) {
  const normalized = text.toLowerCase();
  return /[іїєґ]/.test(normalized) || /[а-я]/.test(normalized);
}

function makeTitleFromCaption(caption, fallback) {
  const line = caption
    .split("\n")
    .map((part) => collapseWhitespace(part))
    .find(Boolean);
  const source = line || fallback;
  const sentence = source.split(/[.!?]/)[0] || source;
  const compact = collapseWhitespace(sentence).replace(/^[-–—•\s]+/, "");
  if (!compact) {
    return fallback;
  }
  if (compact.length <= 58) {
    return compact;
  }
  const shortened = compact.slice(0, 58);
  const safeCut = shortened.includes(" ")
    ? shortened.slice(0, shortened.lastIndexOf(" "))
    : shortened;
  return `${safeCut.trimEnd()}…`;
}

function slugify(value, shortcode) {
  const base = value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return base ? `${base}-${shortcode.toLowerCase()}` : `instagram-${shortcode.toLowerCase()}`;
}

function extractHashtags(text) {
  const matches = text.match(/#([\p{L}\p{N}_]+)/gu) || [];
  const tags = [...new Set(matches.map((item) => item.slice(1).toLowerCase()))];
  return tags.slice(0, 12);
}

function extractShortcodeFromPost(post) {
  const src = post?.media?.[0]?.src || "";
  const filename = src.split("/").pop();
  if (!filename) {
    const match = String(post.id || "").match(/^ig-([a-z0-9_-]{6,})$/i);
    return match ? match[1].toUpperCase() : null;
  }
  const basename = filename.replace(/\.(jpg|jpeg|png|webp)$/i, "");
  const normalized = basename.replace(/-\d+$/, "");
  return normalized ? normalized.toUpperCase() : null;
}

async function main() {
  await fs.mkdir(BLOG_IMAGE_DIR, { recursive: true });

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

  const imported = [];

  for (const edge of sortedEdges) {
    const node = edge?.node;
    if (!node) continue;

    const shortcode = String(node.shortcode || "").toUpperCase();
    if (!shortcode) {
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
    const slug = slugify(enTitle, shortcode);

    const imagePath = path.join(BLOG_IMAGE_DIR, `${shortcode}.jpg`);
    await downloadFile(node.display_url, imagePath);

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
      media: [
        {
          id: `media-ig-${shortcode.toLowerCase()}`,
          type: "image",
          src: `/images/blog/${shortcode}.jpg`,
          alt: enTitle,
        },
      ],
    };

    const existing = postsByShortcode.get(shortcode);
    postsByShortcode.set(shortcode, post);

    imported.push({
      shortcode,
      action: existing ? "updated" : "added",
      slug,
      date: post.date,
      image: `/images/blog/${shortcode}.jpg`,
    });
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
