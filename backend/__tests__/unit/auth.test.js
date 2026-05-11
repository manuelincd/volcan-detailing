// __tests__/unit/auth.test.js

// ── Mocks ─────────────────────────────────────────────────────────────────────
jest.mock("../../src/utils/jwt");
jest.mock("../../src/utils/response");

const { verifyAccess } = require("../../src/utils/jwt");
const { fail } = require("../../src/utils/response");
const authMiddleware = require("../../src/middlewares/auth");

// ── Helpers para simular objetos de Express ───────────────────────────────────
const mockRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });
const mockNext = () => jest.fn();

// Payload que simula un usuario ya autenticado
const DECODED_USER = { id: 1, email: "cliente1@volcan.com", role: "client" };

// Limpia todos los mocks entre tests para evitar contaminación
beforeEach(() => jest.clearAllMocks());

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 1 — Casos donde NO hay token (debe rechazar)
// ─────────────────────────────────────────────────────────────────────────────
describe("auth middleware — sin token", () => {
  test("debe rechazar si no hay header Authorization", () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = mockNext();

    authMiddleware(req, res, next);

    expect(fail).toHaveBeenCalledWith(res, "Unauthorized", "UNAUTHORIZED", 401);
    expect(next).not.toHaveBeenCalled();
  });

  test('debe rechazar si el header no empieza con "Bearer "', () => {
    const req = { headers: { authorization: "Token abc123" } };
    const res = mockRes();
    const next = mockNext();

    authMiddleware(req, res, next);

    expect(fail).toHaveBeenCalledWith(res, "Unauthorized", "UNAUTHORIZED", 401);
    expect(next).not.toHaveBeenCalled();
  });

  test('debe rechazar si el header es solo "Bearer " sin token', () => {
    const req = { headers: { authorization: "Bearer " } };
    const res = mockRes();
    const next = mockNext();

    // verifyAccess recibirá string vacío y lanzará error
    verifyAccess.mockImplementation(() => {
      throw new Error("jwt malformed");
    });

    authMiddleware(req, res, next);

    expect(fail).toHaveBeenCalledWith(
      res,
      "Unauthorized",
      "INVALID_TOKEN",
      401,
    );
    expect(next).not.toHaveBeenCalled();
  });

  test("debe rechazar si el header Authorization está en minúsculas mal formado", () => {
    const req = { headers: { authorization: "basic dXNlcjpwYXNz" } };
    const res = mockRes();
    const next = mockNext();

    authMiddleware(req, res, next);

    expect(fail).toHaveBeenCalledWith(res, "Unauthorized", "UNAUTHORIZED", 401);
    expect(next).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 2 — Token válido (debe pasar)
// ─────────────────────────────────────────────────────────────────────────────
describe("auth middleware — token válido", () => {
  test("debe llamar next() si el token es válido", () => {
    verifyAccess.mockReturnValue(DECODED_USER);

    const req = { headers: { authorization: "Bearer token.valido.aqui" } };
    const res = mockRes();
    const next = mockNext();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(fail).not.toHaveBeenCalled();
  });

  test("debe asignar el usuario decodificado a req.user", () => {
    verifyAccess.mockReturnValue(DECODED_USER);

    const req = { headers: { authorization: "Bearer token.valido.aqui" } };
    const res = mockRes();
    const next = mockNext();

    authMiddleware(req, res, next);

    expect(req.user).toEqual(DECODED_USER);
  });

  test("req.user debe contener id, email y role correctamente", () => {
    verifyAccess.mockReturnValue(DECODED_USER);

    const req = { headers: { authorization: "Bearer token.valido.aqui" } };
    const res = mockRes();
    const next = mockNext();

    authMiddleware(req, res, next);

    expect(req.user.id).toBe(1);
    expect(req.user.email).toBe("cliente1@volcan.com");
    expect(req.user.role).toBe("client");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 3 — Token inválido o manipulado (seguridad crítica)
// ─────────────────────────────────────────────────────────────────────────────
describe("auth middleware — token inválido", () => {
  test("debe responder INVALID_TOKEN si el token está manipulado", () => {
    const error = new Error("invalid signature");
    error.name = "JsonWebTokenError";
    verifyAccess.mockImplementation(() => {
      throw error;
    });

    const req = { headers: { authorization: "Bearer token.manipulado.xyz" } };
    const res = mockRes();
    const next = mockNext();

    authMiddleware(req, res, next);

    expect(fail).toHaveBeenCalledWith(
      res,
      "Unauthorized",
      "INVALID_TOKEN",
      401,
    );
    expect(next).not.toHaveBeenCalled();
  });

  test("debe responder INVALID_TOKEN si el token está malformado", () => {
    const error = new Error("jwt malformed");
    error.name = "JsonWebTokenError";
    verifyAccess.mockImplementation(() => {
      throw error;
    });

    const req = { headers: { authorization: "Bearer noesunjwt" } };
    const res = mockRes();
    const next = mockNext();

    authMiddleware(req, res, next);

    expect(fail).toHaveBeenCalledWith(
      res,
      "Unauthorized",
      "INVALID_TOKEN",
      401,
    );
    expect(next).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 4 — Token expirado (código especial para silent refresh)
// ─────────────────────────────────────────────────────────────────────────────
describe("auth middleware — token expirado", () => {
  test("debe responder TOKEN_EXPIRED cuando el token venció", () => {
    const error = new Error("jwt expired");
    error.name = "TokenExpiredError";
    verifyAccess.mockImplementation(() => {
      throw error;
    });

    const req = { headers: { authorization: "Bearer token.expirado.aqui" } };
    const res = mockRes();
    const next = mockNext();

    authMiddleware(req, res, next);

    expect(fail).toHaveBeenCalledWith(
      res,
      "Unauthorized",
      "TOKEN_EXPIRED",
      401,
    );
    expect(next).not.toHaveBeenCalled();
  });

  test("TOKEN_EXPIRED debe ser distinto de INVALID_TOKEN (el frontend los trata diferente)", () => {
    // Este test documenta el comportamiento esperado del sistema:
    // TOKEN_EXPIRED → el frontend intenta silent refresh
    // INVALID_TOKEN → el frontend fuerza re-login

    const expiredError = new Error("jwt expired");
    expiredError.name = "TokenExpiredError";
    verifyAccess.mockImplementation(() => {
      throw expiredError;
    });

    const req = {
      headers: { authorization: "Bearer cualquier.token.expirado" },
    };
    const res = mockRes();
    const next = mockNext();

    authMiddleware(req, res, next);

    const [, , errorCode] = fail.mock.calls[0];
    expect(errorCode).toBe("TOKEN_EXPIRED");
    expect(errorCode).not.toBe("INVALID_TOKEN");
  });
});
