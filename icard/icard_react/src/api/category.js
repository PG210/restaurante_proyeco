import { createResourceApi, toFormData } from "./resource";

export const categoryApi = createResourceApi("/api/categories/", { serialize: toFormData });
