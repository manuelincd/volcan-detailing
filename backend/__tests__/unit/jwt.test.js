// __tests__/unit/jwt.test.js

jest.mock("../../src/config/env", () => ({
  env: {
    JWT_SECRET: "test-access-secret-super-seguro-32chars!!",
    JWT_REFRESH_SECRET: "test-refresh-secret-super-seguro-32chars!",
    JWT_ACCESS_EXPIRES: "15m",
    JWT_REFRESH_EXPIRES: "7d",
  },
}));

const jwt = require("jsonwebtoken");
const {
  signAccess,
  signRefresh,
  signTemp,
  verifyAccess,
  verifyRefresh,
  verifyTemp,
} = require("../../src/utils/jwt");

const BASE_PAYLOAD = { id: 1, email: "admin@volcan.com", role: "admin" };

// ─────────────────────────────────────────────────────────────────────────────
describe("signAccess", () => {
  test("debe retornar un string (el token JWT)", () => {
    const token = signAccess(BASE_PAYLOAD);
    expect(typeof token).toBe("string");
  });

  test("el token debe tener 3 partes separadas por punto", () => {
    const token = signAccess(BASE_PAYLOAD);
    expect(token.split(".")).toHaveLength(3);
  });

  test("el payload decodificado debe contener los datos originales", () => {
    const token = signAccess(BASE_PAYLOAD);
    const decoded = verifyAccess(token);
    expect(decoded.id).toBe(BASE_PAYLOAD.id);
    expect(decoded.email).toBe(BASE_PAYLOAD.email);
    expect(decoded.role).toBe(BASE_PAYLOAD.role);
  });

  test("debe incluir exp en el payload", () => {
    const token = signAccess(BASE_PAYLOAD);
    const decoded = verifyAccess(token);
    expect(decoded.exp).toBeDefined();
  });

  test("la expiración debe ser aproximadamente 15 minutos", () => {
    const ahora = Math.floor(Date.now() / 1000);
    const token = signAccess(BASE_PAYLOAD);
    const decoded = verifyAccess(token);
    const diff = decoded.exp - ahora;
    expect(diff).toBeGreaterThan(890);
    expect(diff).toBeLessThanOrEqual(900);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("signRefresh", () => {
  test("debe retornar un string válido de 3 partes", () => {
    const token = signRefresh(BASE_PAYLOAD);
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);
  });

  test("el payload decodificado debe contener los datos originales", () => {
    const token = signRefresh(BASE_PAYLOAD);
    const decoded = verifyRefresh(token);
    expect(decoded.id).toBe(BASE_PAYLOAD.id);
    expect(decoded.role).toBe(BASE_PAYLOAD.role);
  });

  test("la expiración debe ser aproximadamente 7 días", () => {
    const ahora = Math.floor(Date.now() / 1000);
    const token = signRefresh(BASE_PAYLOAD);
    const decoded = verifyRefresh(token);
    const SIETE_DIAS = 7 * 24 * 60 * 60;
    const diff = decoded.exp - ahora;
    expect(diff).toBeGreaterThan(SIETE_DIAS - 5);
    expect(diff).toBeLessThanOrEqual(SIETE_DIAS);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("signTemp", () => {
  test("debe retornar un token JWT válido", () => {
    const token = signTemp(BASE_PAYLOAD);
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);
  });

  test("la expiración debe ser aproximadamente 5 minutos", () => {
    const ahora = Math.floor(Date.now() / 1000);
    const token = signTemp(BASE_PAYLOAD);
    const decoded = verifyTemp(token);
    const diff = decoded.exp - ahora;
    expect(diff).toBeGreaterThan(290);
    expect(diff).toBeLessThanOrEqual(300);
  });

  test("debe poder verificarse con verifyTemp", () => {
    const token = signTemp(BASE_PAYLOAD);
    expect(() => verifyTemp(token)).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("verifyAccess — casos de rechazo", () => {
  test("debe lanzar error con token completamente inválido", () => {
    expect(() => verifyAccess("esto.no.esuntoken")).toThrow();
  });

  test("debe lanzar JsonWebTokenError con payload manipulado", () => {
    const token = signAccess(BASE_PAYLOAD);
    const partes = token.split(".");
    partes[1] = Buffer.from(JSON.stringify({ id: 99, role: "admin" })).toString(
      "base64",
    );
    expect(() => verifyAccess(partes.join("."))).toThrow(jwt.JsonWebTokenError);
  });

  test("debe rechazar token firmado con secret de atacante", () => {
    const falso = jwt.sign(BASE_PAYLOAD, "secret-de-atacante", {
      algorithm: "HS256",
    });
    expect(() => verifyAccess(falso)).toThrow(jwt.JsonWebTokenError);
  });

  test("debe lanzar TokenExpiredError con token expirado", () => {
    const expirado = jwt.sign(
      BASE_PAYLOAD,
      "test-access-secret-super-seguro-32chars!!",
      { algorithm: "HS256", expiresIn: -1 },
    );
    expect(() => verifyAccess(expirado)).toThrow(jwt.TokenExpiredError);
  });

  test("NO debe aceptar un refresh token como access token", () => {
    const refresh = signRefresh(BASE_PAYLOAD);
    expect(() => verifyAccess(refresh)).toThrow(jwt.JsonWebTokenError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("verifyRefresh — casos de rechazo", () => {
  test("debe lanzar error con token inválido", () => {
    expect(() => verifyRefresh("token.invalido.aqui")).toThrow();
  });

  test("NO debe aceptar un access token como refresh token", () => {
    const access = signAccess(BASE_PAYLOAD);
    expect(() => verifyRefresh(access)).toThrow(jwt.JsonWebTokenError);
  });

  test("debe lanzar error con token manipulado", () => {
    const token = signRefresh(BASE_PAYLOAD);
    expect(() => verifyRefresh(token.slice(0, -5) + "XXXXX")).toThrow();
  });
});
