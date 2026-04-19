import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultSiteContent } from '../../../src/config/defaultSiteContent';
import { defaultSiteMedia } from '../../../src/config/defaultSiteMedia';
import {
  validateSiteContentInput,
  validateSiteMediaInput,
  validateVideoConfigUpdate,
} from '../../../src/lib/adminConfigValidation';

test('validateSiteContentInput accepts valid content payloads', () => {
  const content = validateSiteContentInput(defaultSiteContent);

  assert.equal(content.hero.badge, defaultSiteContent.hero.badge);
  assert.equal(content.blog.posts[0]?.status, defaultSiteContent.blog.posts[0]?.status);
});

test('validateSiteContentInput rejects invalid blog statuses', () => {
  assert.throws(
    () =>
      validateSiteContentInput({
        ...defaultSiteContent,
        blog: {
          ...defaultSiteContent.blog,
          posts: [
            {
              ...defaultSiteContent.blog.posts[0],
              status: 'live',
            },
          ],
        },
      }),
    /blog\.posts\[0\]\.status/i
  );
});

test('validateSiteMediaInput rejects invalid gallery payloads', () => {
  assert.throws(
    () =>
      validateSiteMediaInput({
        ...defaultSiteMedia,
        stores: {
          ...defaultSiteMedia.stores,
          kw: {
            ...defaultSiteMedia.stores.kw,
            gallery: [{ id: 'bad-item', image: 42 }],
          },
        },
      }),
    /stores\.kw\.gallery\[0\]\.image/i
  );
});

test('validateVideoConfigUpdate rejects unsafe hero video paths', () => {
  assert.throws(
    () =>
      validateVideoConfigUpdate({
        heroVideo: '../secret.mp4',
      }),
    /heroVideo/i
  );
});
