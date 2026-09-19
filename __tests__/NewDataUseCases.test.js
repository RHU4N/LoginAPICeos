const FavoriteUseCases = require("../src/application/use_cases/FavoriteUseCases");
const CustomFunctionUseCases = require("../src/application/use_cases/CustomFunctionUseCases");
const IoTUseCases = require("../src/application/use_cases/IoTUseCases");

describe("ST12 — criação e consulta das novas estruturas", () => {
  const userId = "507f1f77bcf86cd799439011";

  test("cria e lista favoritos somente do usuário autenticado", async () => {
    const repository = {
      create: jest.fn().mockResolvedValue({ _id: "favorite-1", userId }),
      listByUser: jest.fn().mockResolvedValue([{ _id: "favorite-1", userId }]),
    };
    const useCases = new FavoriteUseCases(repository);
    await expect(useCases.create(userId, { resourceId: "507f1f77bcf86cd799439012", resourceType: "calculation", nome: "Juros" })).resolves.toMatchObject({ userId });
    await expect(useCases.list(userId)).resolves.toHaveLength(1);
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ userId }));
    expect(repository.listByUser).toHaveBeenCalledWith(userId);
  });

  test("cria, consulta e atualiza função personalizada do dono", async () => {
    const functionData = { _id: "function-1", userId, nome: "Área", categoria: "matematica", tipo: "formula", formula: "b*h/2" };
    const repository = {
      create: jest.fn().mockResolvedValue(functionData),
      findOwned: jest.fn().mockResolvedValue(functionData),
      updateOwned: jest.fn().mockResolvedValue({ ...functionData, nome: "Área do triângulo" }),
    };
    const useCases = new CustomFunctionUseCases(repository);
    await expect(useCases.create(userId, functionData)).resolves.toMatchObject({ userId });
    await expect(useCases.get(userId, "function-1")).resolves.toMatchObject({ nome: "Área" });
    await expect(useCases.update(userId, "function-1", { nome: "Área do triângulo" })).resolves.toMatchObject({ nome: "Área do triângulo" });
    expect(repository.findOwned).toHaveBeenCalledWith("function-1", userId);
  });

  test("cria e consulta medições IoT com filtro e paginação", async () => {
    const measurement = { _id: "measurement-1", userId, deviceId: "ESP32-001", sensorId: "temperature-01", sensorTipo: "temperatura", valor: 25.7, unidade: "C", timestamp: new Date("2026-09-18T10:30:00Z") };
    const repository = {
      create: jest.fn().mockResolvedValue(measurement),
      list: jest.fn().mockResolvedValue({ items: [measurement], total: 1 }),
      findOwned: jest.fn().mockResolvedValue(measurement),
    };
    const useCases = new IoTUseCases(repository);
    await expect(useCases.create(userId, measurement)).resolves.toMatchObject({ deviceId: "ESP32-001" });
    await expect(useCases.list(userId, { deviceId: "ESP32-001", page: 1, limit: 50 })).resolves.toMatchObject({ total: 1 });
    await expect(useCases.get(userId, "measurement-1")).resolves.toMatchObject({ sensorId: "temperature-01" });
    expect(repository.list).toHaveBeenCalledWith({ userId, deviceId: "ESP32-001" }, 1, 50);
    expect(repository.findOwned).toHaveBeenCalledWith("measurement-1", userId);
  });
});
