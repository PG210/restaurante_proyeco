import { createResourceApi } from "./resource";

export const tableApi = createResourceApi("/api/tables/", { updateMethod: "PUT" });
