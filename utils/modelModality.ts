import { Model, ModelModality } from '../types';

const MAX_MODALITY_TAGS = 3;
const DEFAULT_MODALITY: ModelModality = 'text';

const isValidModality = (value: unknown): value is ModelModality =>
  value === 'video' || value === 'image' || value === 'text';

export const normalizeModalities = (
  input?: Array<ModelModality | string> | null,
  fallback?: ModelModality
): ModelModality[] => {
  const list = Array.isArray(input) ? input : [];
  const normalized: ModelModality[] = [];
  for (const item of list) {
    if (!isValidModality(item)) continue;
    if (normalized.includes(item)) continue;
    normalized.push(item);
    if (normalized.length >= MAX_MODALITY_TAGS) break;
  }
  if (normalized.length === 0) {
    const safeFallback = isValidModality(fallback) ? fallback : DEFAULT_MODALITY;
    return [safeFallback];
  }
  return normalized;
};

export const resolveModelModalities = (model?: Model | null): ModelModality[] => {
  if (model) {
    if (Array.isArray(model.modalities) && model.modalities.length > 0) {
      return normalizeModalities(model.modalities, model.modality);
    }
    if (model.modality) {
      return normalizeModalities([model.modality], model.modality);
    }
    const id = String(model.id || '').toLowerCase();
    if (id.includes('sora-video') || id.includes('video')) return ['video'];
    if (id.includes('image')) return ['image'];
  }
  return [DEFAULT_MODALITY];
};

export const resolvePrimaryModality = (model?: Model | null): ModelModality =>
  resolveModelModalities(model)[0] || DEFAULT_MODALITY;

export const hasModelModality = (model: Model | null | undefined, modality: ModelModality): boolean =>
  resolveModelModalities(model).includes(modality);
