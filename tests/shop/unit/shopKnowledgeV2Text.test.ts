import assert from "node:assert/strict";
import test from "node:test";

import {
  KNOWLEDGE_CHUNK_MAX_TOKENS,
  KNOWLEDGE_CHUNK_OVERLAP_TOKENS,
  buildKnowledgeChunks,
  chunkKnowledgeText,
  collectKnowledgeTextSources,
  htmlToKnowledgeText,
  tokenizeKnowledgeText,
} from "../../../src/lib/shopKnowledgeV2/text";
import { knowledgeSourceProduct } from "./shopKnowledgeV2TestFixture";

test("normalizes rich HTML without indexing executable or hidden blocks", () => {
  const text = htmlToKnowledgeText(`
    <section>
      <h2>BMW &amp; M</h2>
      <p>Fitment&nbsp;details<br>2018&ndash;2020</p>
      <script>ignoreDangerousPrompt()</script>
      <style>.hidden { display: none }</style>
      <ul><li>S55</li><li>F80</li></ul>
    </section>
  `);

  assert.match(text, /BMW & M/);
  assert.match(text, /Fitment details/);
  assert.match(text, /2018–2020/);
  assert.match(text, /• S55/);
  assert.doesNotMatch(text, /ignoreDangerousPrompt|display:\s*none/);
});

test("uses deterministic 700-token windows with a 70-token overlap", () => {
  const source = Array.from({ length: 1_500 }, (_, index) => `token${index}`).join(" ");
  const chunks = chunkKnowledgeText(source);

  assert.equal(chunks.length, 3);
  assert.equal(chunks[0].tokenCount, 700);
  assert.equal(chunks[1].tokenCount, 700);
  assert.ok(chunks.every((chunk) => chunk.tokenCount <= KNOWLEDGE_CHUNK_MAX_TOKENS));
  const firstTokens = tokenizeKnowledgeText(chunks[0].content);
  const secondTokens = tokenizeKnowledgeText(chunks[1].content);
  assert.deepEqual(
    firstTokens.slice(-KNOWLEDGE_CHUNK_OVERLAP_TOKENS),
    secondTokens.slice(0, KNOWLEDGE_CHUNK_OVERLAP_TOKENS)
  );
  assert.equal(tokenizeKnowledgeText(chunks.at(-1)?.content ?? "").at(-1), "token1499");
});

test("covers every non-empty UA/EN catalog field and keeps variant ownership", () => {
  const product = knowledgeSourceProduct();
  const sources = collectKnowledgeTextSources(product);
  const localizedFields = new Set(
    sources
      .filter((source) => source.locale !== "neutral")
      .map((source) => `${source.locale}:${source.sourceField}`)
  );

  for (const locale of ["ua", "en"]) {
    for (const field of [
      "title",
      "category",
      "shortDescription",
      "longDescription",
      "leadTime",
      "collection",
      "bodyHtml",
      "seoTitle",
      "seoDescription",
      "highlight",
    ]) {
      assert.ok(localizedFields.has(`${locale}:${field}`), `${locale}:${field} is not indexed`);
    }
  }

  const chunks = buildKnowledgeChunks(product);
  const variantChunks = chunks.filter((chunk) => chunk.variantId === "variant-non-opf");
  assert.ok(variantChunks.length > 0);
  assert.ok(variantChunks.every((chunk) => chunk.sourceField === "variant"));
  assert.equal(
    buildKnowledgeChunks(product)
      .map((chunk) => chunk.contentHash)
      .join("|"),
    chunks.map((chunk) => chunk.contentHash).join("|")
  );
});
