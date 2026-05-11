'use strict';

const { containsHtml, stripHtml } = require('../../src/utils/sanitize');

describe('containsHtml', () => {
  describe('returns true for HTML injection vectors', () => {
    const cases = [
      ['script tag',                 '<script>alert(1)</script>'],
      ['closing script tag',         '</script>'],
      ['img onerror',                '<img src=x onerror=alert(1)>'],
      ['svg onload',                 '<svg onload=alert(1)>'],
      ['anchor with javascript URI', '<a href="javascript:void(0)">click</a>'],
      ['style tag',                  '<style>body{display:none}</style>'],
      ['input autofocus',            '<input autofocus onfocus=alert(1)>'],
      ['details ontoggle',           '<details open ontoggle=alert(1)>'],
      ['mixed case tag',             '<ScRiPt>alert(1)</ScRiPt>'],
      ['tag with leading space',     '< script>alert(1)</ script>'],
      ['iframe',                     '<iframe src="evil.com">'],
      ['html entity bypass attempt', '<img/src="x"onerror=alert(1)>'],
    ];

    test.each(cases)('%s', (_label, input) => {
      expect(containsHtml(input)).toBe(true);
    });
  });

  describe('returns false for plain text', () => {
    const cases = [
      ['empty string',             ''],
      ['plain sentence',           'Lavado exterior completo con cera'],
      ['string with ampersand',    'Jabón & desengrasante profesional'],
      ['string with numbers',      'Duración: 90 minutos, precio: $350'],
      ['string with parentheses',  'Incluye (interior + exterior)'],
      ['string with quotes',       'Acabado tipo "showroom"'],
      ['loose less-than',          'precio < $500'],
      ['loose greater-than',       'calidad > estándar'],
    ];

    test.each(cases)('%s', (_label, input) => {
      expect(containsHtml(input)).toBe(false);
    });
  });

  it('is not affected by regex lastIndex across repeated calls', () => {
    expect(containsHtml('<b>bold</b>')).toBe(true);
    expect(containsHtml('<b>bold</b>')).toBe(true);
    expect(containsHtml('plain text')).toBe(false);
    expect(containsHtml('plain text')).toBe(false);
  });
});

describe('stripHtml', () => {
  it('strips a single tag and returns the inner text', () => {
    expect(stripHtml('<b>hello</b>')).toBe('hello');
  });

  it('strips tags and leaves inner text', () => {
    // Tags are removed; bare text is not executable and is harmless in a JSON field.
    expect(stripHtml('<script>alert(1)</script>')).toBe('alert(1)');
  });

  it('strips tags while preserving surrounding text', () => {
    expect(stripHtml('Hello <b>world</b> foo')).toBe('Hello world foo');
  });

  it('strips img onerror payload', () => {
    expect(stripHtml('<img src=x onerror=alert(1)>')).toBe('');
  });

  it('strips nested tags', () => {
    expect(stripHtml('<div><p>text</p></div>')).toBe('text');
  });

  it('returns plain text unchanged', () => {
    expect(stripHtml('Detallado premium')).toBe('Detallado premium');
  });

  it('trims whitespace left after stripping', () => {
    expect(stripHtml('  <b></b>  ')).toBe('');
  });
});
