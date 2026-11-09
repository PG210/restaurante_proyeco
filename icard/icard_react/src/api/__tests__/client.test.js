import { ApiError, apiRequest, setSessionExpiredHandler } from "../client";
import { getRefreshToken, getToken, setTokens } from "../token";
import { BASE_API } from "../../utils/constants";

function mockResponse(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => (body === undefined ? "" : JSON.stringify(body)),
    json: async () => body,
  };
}

function requestHeaders(callIndex) {
  return global.fetch.mock.calls[callIndex][1].headers;
}

describe("apiRequest", () => {
  let onSessionExpired;

  beforeEach(() => {
    localStorage.clear();
    global.fetch = jest.fn();
    onSessionExpired = jest.fn();
    setSessionExpiredHandler(onSessionExpired);
  });

  it("sends the access token and a JSON body, and returns the parsed response", async () => {
    setTokens({ access: "access-1", refresh: "refresh-1" });
    global.fetch.mockResolvedValueOnce(mockResponse(201, { id: 7 }));

    const result = await apiRequest("/api/tables/", { method: "POST", body: { number: 7 } });

    expect(result).toEqual({ id: 7 });
    expect(global.fetch).toHaveBeenCalledWith(`${BASE_API}/api/tables/`, {
      method: "POST",
      headers: { Authorization: "Bearer access-1", "Content-Type": "application/json" },
      body: JSON.stringify({ number: 7 }),
    });
  });

  it("returns null for a 204 response without reading the body", async () => {
    setTokens({ access: "access-1", refresh: "refresh-1" });
    const response = mockResponse(204);
    response.text = jest.fn();
    global.fetch.mockResolvedValueOnce(response);

    const result = await apiRequest("/api/categories/3/", { method: "DELETE" });

    expect(result).toBeNull();
    expect(response.text).not.toHaveBeenCalled();
  });

  it("does not set a JSON content type for multipart bodies", async () => {
    setTokens({ access: "access-1", refresh: "refresh-1" });
    global.fetch.mockResolvedValueOnce(mockResponse(201, { id: 1 }));

    await apiRequest("/api/products/", { method: "POST", body: new FormData() });

    expect(requestHeaders(0)).toEqual({ Authorization: "Bearer access-1" });
  });

  it("refreshes the access token once and retries after a 401", async () => {
    setTokens({ access: "expired", refresh: "refresh-1" });
    global.fetch
      .mockResolvedValueOnce(mockResponse(401, { detail: "Token expirado" }))
      .mockResolvedValueOnce(mockResponse(200, { access: "access-2" }))
      .mockResolvedValueOnce(mockResponse(200, [{ id: 1 }]));

    const result = await apiRequest("/api/tables/");

    expect(result).toEqual([{ id: 1 }]);
    expect(global.fetch.mock.calls[1][0]).toBe(`${BASE_API}/api/auth/refresh/`);
    expect(requestHeaders(2).Authorization).toBe("Bearer access-2");
    expect(getToken()).toBe("access-2");
  });

  it("shares a single refresh between concurrent 401 responses", async () => {
    setTokens({ access: "expired", refresh: "refresh-1" });
    global.fetch.mockImplementation(async (url, options) => {
      if (url.endsWith("/api/auth/refresh/")) return mockResponse(200, { access: "access-2" });
      if (options.headers.Authorization === "Bearer expired") return mockResponse(401, {});
      return mockResponse(200, []);
    });

    await Promise.all([apiRequest("/api/tables/"), apiRequest("/api/orders/")]);

    const refreshCalls = global.fetch.mock.calls.filter(([url]) => url.endsWith("/api/auth/refresh/"));
    expect(refreshCalls).toHaveLength(1);
  });

  it("ends the session when the refresh token is rejected", async () => {
    setTokens({ access: "expired", refresh: "expired-refresh" });
    global.fetch
      .mockResolvedValueOnce(mockResponse(401, {}))
      .mockResolvedValueOnce(mockResponse(401, { detail: "Token inválido" }));

    await expect(apiRequest("/api/tables/")).rejects.toMatchObject({ status: 401 });

    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    expect(getToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it("does not attach a token or try to refresh for public requests", async () => {
    setTokens({ access: "access-1", refresh: "refresh-1" });
    global.fetch.mockResolvedValueOnce(mockResponse(401, { detail: "Credenciales inválidas" }));

    await expect(apiRequest("/api/auth/login/", { method: "POST", body: {}, auth: false })).rejects.toThrow(
      "Credenciales inválidas",
    );

    expect(requestHeaders(0).Authorization).toBeUndefined();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it("throws an ApiError with the backend detail and status", async () => {
    setTokens({ access: "access-1", refresh: "refresh-1" });
    global.fetch.mockResolvedValueOnce(mockResponse(403, { detail: "No tiene permiso" }));

    const request = apiRequest("/api/users/");

    await expect(request).rejects.toBeInstanceOf(ApiError);
    await expect(request).rejects.toMatchObject({ status: 403, message: "No tiene permiso" });
  });

  it("uses the first field error as the message for validation errors", async () => {
    setTokens({ access: "access-1", refresh: "refresh-1" });
    global.fetch.mockResolvedValueOnce(mockResponse(400, { number: ["Ya existe una mesa con este número."] }));

    await expect(apiRequest("/api/tables/", { method: "POST", body: { number: 1 } })).rejects.toThrow(
      "number: Ya existe una mesa con este número.",
    );
  });
});
