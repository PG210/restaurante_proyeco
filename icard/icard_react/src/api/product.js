import { createResourceApi, toFormData } from "./resource";

export const productApi = createResourceApi("/api/products/", { serialize: toFormData });
