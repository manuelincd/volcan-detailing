'use strict';

const serviceSchema = require('../../src/schemas/serviceSchema');

const VALID_PRICES = { sedan: 120, suv: 160, van: 200 };

const BASE_CREATE = {
  name:            'Lavado Exterior',
  durationMinutes: 60,
  prices:          VALID_PRICES,
};

const BASE_UPDATE = {
  ...BASE_CREATE,
  isActive: true,
};

function validate(schema, value) {
  return schema.validate(value, { abortEarly: false });
}

// ─── create ──────────────────────────────────────────────────────────────────

describe('serviceSchema.create', () => {
  it('accepts a valid payload without description', () => {
    const { error } = validate(serviceSchema.create, BASE_CREATE);
    expect(error).toBeUndefined();
  });

  it('accepts a valid payload with a plain-text description', () => {
    const { error } = validate(serviceSchema.create, {
      ...BASE_CREATE,
      description: 'Lavado exterior con espuma activa y cera de carnauba.',
    });
    expect(error).toBeUndefined();
  });

  describe('rejects description containing HTML tags', () => {
    const xssVectors = [
      ['script tag',          '<script>alert(1)</script>'],
      ['img onerror',         '<img src=x onerror=alert(1)>'],
      ['svg onload',          '<svg onload=alert(1)>'],
      ['anchor JS href',      '<a href="javascript:void(0)">x</a>'],
      ['style tag',           '<style>*{display:none}</style>'],
      ['iframe',              '<iframe src="evil.com">'],
      ['mixed-case script',   '<ScRiPt>alert(1)</ScRiPt>'],
      ['spaced tag',          '< script>alert(1)</ script>'],
      ['bold tag in text',    'Precio: <b>100</b> MXN'],
    ];

    test.each(xssVectors)('%s', (_label, description) => {
      const { error } = validate(serviceSchema.create, { ...BASE_CREATE, description });
      expect(error).toBeDefined();
      expect(error.details[0].message).toMatch(/must not contain HTML tags/i);
    });
  });

  it('strips unknown top-level keys (stripUnknown)', () => {
    const { value, error } = validate(serviceSchema.create, {
      ...BASE_CREATE,
      isActive:    true,   // not allowed on create
      __proto__:   {},
      extraField:  'injected',
    });
    expect(error).toBeUndefined();
    expect(value).not.toHaveProperty('isActive');
    expect(value).not.toHaveProperty('extraField');
  });

  it('rejects an extra key inside prices', () => {
    const { error } = validate(serviceSchema.create, {
      ...BASE_CREATE,
      prices: { ...VALID_PRICES, truck: 999 },
    });
    expect(error).toBeDefined();
    expect(error.details[0].message).toMatch(/truck/);
  });

  it('rejects a non-positive price', () => {
    const { error } = validate(serviceSchema.create, {
      ...BASE_CREATE,
      prices: { sedan: 0, suv: 160, van: 200 },
    });
    expect(error).toBeDefined();
  });

  it('rejects missing prices', () => {
    const { error } = validate(serviceSchema.create, {
      name: 'X', durationMinutes: 30,
    });
    expect(error).toBeDefined();
  });

  it('rejects durationMinutes > 1440', () => {
    const { error } = validate(serviceSchema.create, {
      ...BASE_CREATE,
      durationMinutes: 1441,
    });
    expect(error).toBeDefined();
  });
});

// ─── update ──────────────────────────────────────────────────────────────────

describe('serviceSchema.update', () => {
  it('accepts a valid full-update payload', () => {
    const { error } = validate(serviceSchema.update, BASE_UPDATE);
    expect(error).toBeUndefined();
  });

  it('accepts empty string description (clearing it)', () => {
    const { error } = validate(serviceSchema.update, {
      ...BASE_UPDATE,
      description: '',
    });
    expect(error).toBeUndefined();
  });

  it('accepts isActive: false to deactivate', () => {
    const { error } = validate(serviceSchema.update, {
      ...BASE_UPDATE,
      isActive: false,
    });
    expect(error).toBeUndefined();
  });

  describe('rejects description containing HTML tags', () => {
    const xssVectors = [
      ['script tag',     '<script>alert(1)</script>'],
      ['img onerror',    '<img src=x onerror=alert(1)>'],
      ['inline style',   'Precio: <b>$120</b> MXN'],
    ];

    test.each(xssVectors)('%s', (_label, description) => {
      const { error } = validate(serviceSchema.update, { ...BASE_UPDATE, description });
      expect(error).toBeDefined();
      expect(error.details[0].message).toMatch(/must not contain HTML tags/i);
    });
  });

  it('rejects an extra key inside prices', () => {
    const { error } = validate(serviceSchema.update, {
      ...BASE_UPDATE,
      prices: { ...VALID_PRICES, moto: 50 },
    });
    expect(error).toBeDefined();
  });

  it('strips unknown top-level keys (stripUnknown)', () => {
    const { value, error } = validate(serviceSchema.update, {
      ...BASE_UPDATE,
      injected: '<script>',
    });
    expect(error).toBeUndefined();
    expect(value).not.toHaveProperty('injected');
  });
});
