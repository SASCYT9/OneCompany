import test from "node:test";
import assert from "node:assert/strict";

import { extractSupportedExternalVideos, parseSupportedExternalVideo } from "@/lib/shopProductVideo";

test("normalizes an approved YouTube embed to privacy-enhanced playback", () => {
  assert.deepEqual(parseSupportedExternalVideo("https://www.youtube.com/embed/ny4AegGeaSE?rel=0"), {
    provider: "youtube",
    videoId: "ny4AegGeaSE",
    src: "https://www.youtube-nocookie.com/embed/ny4AegGeaSE",
  });
});

test("extracts and deduplicates YouTube iframes without trusting unrelated embeds", () => {
  const videos = extractSupportedExternalVideos(`
    <iframe src="https://www.youtube.com/embed/first123"></iframe>
    <iframe src="https://www.youtube.com/embed/first123?list=x"></iframe>
    <iframe src="https://evil.example/embed/second123"></iframe>
  `);
  assert.deepEqual(videos.map((video) => video.videoId), ["first123"]);
});
