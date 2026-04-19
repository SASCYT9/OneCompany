import { load } from 'cheerio';

const ALLOWED_TAGS = new Set([
  'a',
  'blockquote',
  'br',
  'code',
  'div',
  'em',
  'figcaption',
  'figure',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'img',
  'li',
  'ol',
  'p',
  'pre',
  'span',
  'strong',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
]);

const ALLOWED_ATTRIBUTES: Record<string, Set<string>> = {
  a: new Set(['href', 'title', 'target', 'rel']),
  img: new Set(['src', 'alt', 'title', 'width', 'height']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan']),
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isSafeUrl(value: string, attributeName: 'href' | 'src') {
  const trimmed = value.trim().replace(/[\u0000-\u001F\u007F\s]+/g, '');
  if (!trimmed) return false;
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) return true;
  if (attributeName === 'src' && trimmed.startsWith('data:image/')) return true;

  try {
    const parsed = new URL(trimmed, 'https://onecompany.local');
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export function htmlToPlainText(value: string | null | undefined) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return '';
  return load(`<body>${normalized}</body>`)('body')
    .text()
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+\n/g, '\n')
    .trim();
}

export function sanitizeRichTextHtml(value: string | null | undefined) {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    return '';
  }

  if (!/<[a-z][\s\S]*>/i.test(normalized)) {
    return escapeHtml(normalized)
      .replace(/\n{2,}/g, '<br/><br/>')
      .replace(/\n/g, '<br/>');
  }

  const $ = load(normalized, {}, false);
  $('script,style,iframe,object,embed,form,input,button,textarea,select,option,meta,link,base,svg,math').remove();

  $.root()
    .find('*')
    .toArray()
    .forEach((element) => {
    const tagName = element.tagName?.toLowerCase() ?? '';
    const wrapped = $(element);

    if (!ALLOWED_TAGS.has(tagName)) {
      wrapped.replaceWith(wrapped.contents());
      return;
    }

    const allowedAttributes = ALLOWED_ATTRIBUTES[tagName] ?? new Set<string>();
    const attributes = { ...(element.attribs || {}) };

    for (const [attributeName, rawValue] of Object.entries(attributes)) {
      const lowerName = attributeName.toLowerCase();
      if (lowerName.startsWith('on')) {
        wrapped.removeAttr(attributeName);
        continue;
      }

      if (!allowedAttributes.has(lowerName)) {
        wrapped.removeAttr(attributeName);
        continue;
      }

      if ((lowerName === 'href' || lowerName === 'src') && !isSafeUrl(rawValue, lowerName)) {
        wrapped.removeAttr(attributeName);
        continue;
      }
    }

    if (tagName === 'a') {
      const target = wrapped.attr('target');
      if (target && target !== '_blank') {
        wrapped.removeAttr('target');
      }
      if (wrapped.attr('target') === '_blank') {
        wrapped.attr('rel', 'noopener noreferrer');
      } else {
        wrapped.removeAttr('rel');
      }
    }
    });

  return $.root().html()?.trim() ?? '';
}
