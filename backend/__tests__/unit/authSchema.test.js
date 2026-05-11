// __tests__/unit/authSchema.test.js

const schema = require("../../src/schemas/authSchema");

// Helper: valida y retorna el error o null
const validate = (schemaKey, data) => {
  const { error } = schema[schemaKey].validate(data, { abortEarly: false });
  return error || null;
};

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 1 — schema.register
// ─────────────────────────────────────────────────────────────────────────────
describe("authSchema.register", () => {
  // ── Casos válidos ──────────────────────────────────────────────────────────
  test("debe aceptar datos de registro completos y válidos", () => {
    const error = validate("register", {
      email: "nuevo@volcan.com",
      password: "Segura@123",
      name: "Juan Pérez",
      phone: "+52 312 000 0000",
    });
    expect(error).toBeNull();
  });

  test("debe aceptar registro sin phone (es opcional)", () => {
    const error = validate("register", {
      email: "nuevo@volcan.com",
      password: "Segura@123",
      name: "Juan Pérez",
    });
    expect(error).toBeNull();
  });

  // ── Email ──────────────────────────────────────────────────────────────────
  test("debe rechazar email inválido", () => {
    const error = validate("register", {
      email: "no-es-email",
      password: "Segura@123",
      name: "Juan",
    });
    expect(error).not.toBeNull();
  });

  test("debe rechazar si falta el email", () => {
    const error = validate("register", {
      password: "Segura@123",
      name: "Juan",
    });
    expect(error).not.toBeNull();
  });

  // ── Password ───────────────────────────────────────────────────────────────
  test("debe rechazar password sin mayúscula", () => {
    const error = validate("register", {
      email: "test@volcan.com",
      password: "sinmayuscula@1",
      name: "Juan",
    });
    expect(error).not.toBeNull();
  });

  test("debe rechazar password sin número", () => {
    const error = validate("register", {
      email: "test@volcan.com",
      password: "SinNumero@aqui",
      name: "Juan",
    });
    expect(error).not.toBeNull();
  });

  test("debe rechazar password sin carácter especial", () => {
    const error = validate("register", {
      email: "test@volcan.com",
      password: "SinEspecial1",
      name: "Juan",
    });
    expect(error).not.toBeNull();
  });

  test("debe rechazar password con menos de 8 caracteres", () => {
    const error = validate("register", {
      email: "test@volcan.com",
      password: "Ab@1",
      name: "Juan",
    });
    expect(error).not.toBeNull();
  });

  test("debe aceptar password exactamente en el límite mínimo (8 chars con todo)", () => {
    const error = validate("register", {
      email: "test@volcan.com",
      password: "Abcde@1!", // 8 chars, mayúscula, número, especial
      name: "Juan",
    });
    expect(error).toBeNull();
  });

  // ── Name ───────────────────────────────────────────────────────────────────
  test("debe rechazar nombre con menos de 2 caracteres", () => {
    const error = validate("register", {
      email: "test@volcan.com",
      password: "Segura@123",
      name: "A",
    });
    expect(error).not.toBeNull();
  });

  test("debe rechazar nombre con más de 100 caracteres", () => {
    const error = validate("register", {
      email: "test@volcan.com",
      password: "Segura@123",
      name: "A".repeat(101),
    });
    expect(error).not.toBeNull();
  });

  // ── Phone ──────────────────────────────────────────────────────────────────
  test("debe aceptar phone con formato internacional", () => {
    const error = validate("register", {
      email: "test@volcan.com",
      password: "Segura@123",
      name: "Juan",
      phone: "+52 312 123 4567",
    });
    expect(error).toBeNull();
  });

  test("debe rechazar phone con menos de 7 dígitos", () => {
    const error = validate("register", {
      email: "test@volcan.com",
      password: "Segura@123",
      name: "Juan",
      phone: "123",
    });
    expect(error).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 2 — schema.login
// ─────────────────────────────────────────────────────────────────────────────
describe("authSchema.login", () => {
  test("debe aceptar email y password válidos", () => {
    const error = validate("login", {
      email: "admin@volcan.com",
      password: "cualquierpassword",
    });
    expect(error).toBeNull();
  });

  test("debe rechazar si falta el email", () => {
    const error = validate("login", { password: "Admin@12345" });
    expect(error).not.toBeNull();
  });

  test("debe rechazar si falta la password", () => {
    const error = validate("login", { email: "admin@volcan.com" });
    expect(error).not.toBeNull();
  });

  test("debe rechazar email malformado en login", () => {
    const error = validate("login", {
      email: "noesvalido",
      password: "Admin@12345",
    });
    expect(error).not.toBeNull();
  });

  test("login NO debe validar complejidad de password (solo required)", () => {
    // En login no se valida la complejidad, solo que exista el campo
    const error = validate("login", {
      email: "admin@volcan.com",
      password: "123", // password débil pero login la acepta
    });
    expect(error).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 3 — schema.changePassword
// ─────────────────────────────────────────────────────────────────────────────
describe("authSchema.changePassword", () => {
  test("debe aceptar cambio de password válido", () => {
    const error = validate("changePassword", {
      currentPassword: "Admin@12345",
      newPassword: "NuevoPass@99",
    });
    expect(error).toBeNull();
  });

  test("debe rechazar si falta currentPassword", () => {
    const error = validate("changePassword", { newPassword: "NuevoPass@99" });
    expect(error).not.toBeNull();
  });

  test("newPassword debe cumplir la política de complejidad", () => {
    const error = validate("changePassword", {
      currentPassword: "Admin@12345",
      newPassword: "sinmayuscula1@", // falta mayúscula
    });
    expect(error).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 4 — schema.mfaVerifySetup y mfaValidate (token TOTP)
// ─────────────────────────────────────────────────────────────────────────────
describe("authSchema.mfaVerifySetup", () => {
  test("debe aceptar token de 6 dígitos exactos", () => {
    const error = validate("mfaVerifySetup", { token: "123456" });
    expect(error).toBeNull();
  });

  test("debe rechazar token con letras", () => {
    const error = validate("mfaVerifySetup", { token: "12345a" });
    expect(error).not.toBeNull();
  });

  test("debe rechazar token con menos de 6 dígitos", () => {
    const error = validate("mfaVerifySetup", { token: "12345" });
    expect(error).not.toBeNull();
  });

  test("debe rechazar token con más de 6 dígitos", () => {
    const error = validate("mfaVerifySetup", { token: "1234567" });
    expect(error).not.toBeNull();
  });

  test("debe rechazar token vacío", () => {
    const error = validate("mfaVerifySetup", { token: "" });
    expect(error).not.toBeNull();
  });
});

describe("authSchema.mfaValidate", () => {
  test("debe aceptar tempToken y token TOTP válidos", () => {
    const error = validate("mfaValidate", {
      tempToken: "eyJhbGciOiJIUzI1NiJ9.payload.signature",
      token: "654321",
    });
    expect(error).toBeNull();
  });

  test("debe rechazar si falta el tempToken", () => {
    const error = validate("mfaValidate", { token: "123456" });
    expect(error).not.toBeNull();
  });

  test("debe rechazar si el token TOTP no son 6 dígitos", () => {
    const error = validate("mfaValidate", {
      tempToken: "alguntoken",
      token: "12X456",
    });
    expect(error).not.toBeNull();
  });
});
