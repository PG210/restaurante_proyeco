import { allergenApi, tagApi } from "../api/productLabel";
import { useCrudResource } from "./useCrudResource";

export function useAllergens() {
  return useCrudResource(allergenApi);
}

export function useTags() {
  return useCrudResource(tagApi);
}
