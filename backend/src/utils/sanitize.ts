import sanitizeHtml from 'sanitize-html';

const BASIC_ALLOWED = ['b', 'i', 'em', 'strong', 'a'];
const MESSAGE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [],
  allowedAttributes: {},
  allowedSchemes: [],
};

const TEXT_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [...BASIC_ALLOWED],
  allowedAttributes: {
    a: ['href', 'rel'],
  },
  allowedSchemes: ['https', 'mailto'],
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        rel: 'noopener noreferrer',
        target: '_blank',
      },
    }),
  },
};

export function sanitizeMessage(body: string): string {
  return sanitizeHtml(body.trim(), MESSAGE_OPTIONS);
}

export function sanitizeText(text: string): string {
  return sanitizeHtml(text.trim(), TEXT_OPTIONS);
}

export function sanitizeBio(bio: string): string {
  return sanitizeHtml(bio.trim(), { ...TEXT_OPTIONS, allowedTags: [...BASIC_ALLOWED, 'br'] });
}

export function sanitizeDisplayName(name: string): string {
  return sanitizeHtml(name.trim(), { allowedTags: [], allowedAttributes: {} });
}
