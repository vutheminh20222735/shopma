export type FitPreference = 'ôm' | 'vừa' | 'rộng';

export type ProductSizeProfile = {
  id?: string;
  category?: string;
  sizes?: string[];
  variants?: Array<{ size: string; stock?: number }>;
  measurements?: Record<string, Record<string, number>>;
};

export type SizeRecommendationInput = {
  heightCm?: number | null;
  weightKg?: number | null;
  fit?: FitPreference | null;
  chestCm?: number | null;
  waistCm?: number | null;
  shoulderCm?: number | null;
  notes?: string | null;
};

export type SizeRecommendationResult = {
  recommendedSize: string;
  reason: string;
  alternatives: Array<{ size: string; reason: string }>; 
  needsMoreData: boolean;
  note: string;
};

const fitAdjustments: Record<FitPreference, number> = {
  'ôm': 0,
  vừa: 1,
  rộng: 2,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function getSizeRecommendation(product: ProductSizeProfile | null | undefined, profile: SizeRecommendationInput): SizeRecommendationResult {
  const sizes = product?.sizes && product.sizes.length ? product.sizes : ['S', 'M', 'L', 'XL'];
  const fit = (profile.fit || 'vừa') as FitPreference;
  const hasBody = !!(profile.heightCm || profile.weightKg || profile.chestCm || profile.waistCm || profile.shoulderCm);

  if (!product || !hasBody) {
    return {
      recommendedSize: sizes[Math.floor(sizes.length / 2)] || 'M',
      reason: 'Thiếu dữ liệu cơ thể để gợi ý chuẩn; vui lòng bổ sung chiều cao, cân nặng và số đo cần thiết.',
      alternatives: sizes.slice(0, 2).map((size) => ({ size, reason: 'Chọn theo cảm giác mặc và kiểm tra lại trước khi đặt hàng.' })),
      needsMoreData: true,
      note: 'Sử dụng bảng đo gợi ý và đối chiếu chiếc áo đang mặc để quyết định cuối cùng.',
    };
  }

  const chest = Number(profile.chestCm ?? 0);
  const height = Number(profile.heightCm ?? 0);
  const weight = Number(profile.weightKg ?? 0);
  const shoulder = Number(profile.shoulderCm ?? 0);

  const metric = [
    chest ? { value: chest, label: 'vòng ngực' } : null,
    height ? { value: height, label: 'chiều cao' } : null,
    weight ? { value: weight, label: 'cân nặng' } : null,
    shoulder ? { value: shoulder, label: 'vai' } : null,
  ].filter(Boolean) as Array<{ value: number; label: string }>;

  const defaultMap = {
    S: 84,
    M: 92,
    L: 100,
    XL: 108,
  } as Record<string, number>;

  const sizeFromChest = sizes.reduce((best, size) => {
    const target = product.measurements?.chest?.[size] ?? defaultMap[size] ?? 90;
    const delta = Math.abs((chest || height / 2 || weight * 1.5) - target);
    return delta < best.delta ? { size, delta } : best;
  }, { size: sizes[0], delta: Number.POSITIVE_INFINITY }).size;

  const score = sizes.map((size) => {
    const target = product.measurements?.chest?.[size] ?? defaultMap[size] ?? 90;
    const sizeDelta = (chest || height * 0.5 || weight * 1.45) - target;
    const heightDelta = ((height || chest * 1.2) - (product.measurements?.height?.[size] ?? 170)) / 8;
    const fitShift = fitAdjustments[fit] ?? 1;
    return { size, score: Math.abs(sizeDelta + heightDelta + fitShift) };
  }).sort((a, b) => a.score - b.score);

  const recommendedSize = score[0]?.size || sizes[0];
  const idx = sizes.indexOf(recommendedSize);
  const alternatives = sizes
    .filter((size) => size !== recommendedSize)
    .slice(0, 2)
    .map((size) => ({
      size,
      reason: `Phương án thay thế nếu bạn thích mặc ${size === recommendedSize ? 'vừa' : fit === 'rộng' ? 'rộng hơn' : 'ôm hơn'}.`,
    }));

  const reasonText = `Gợi ý ${recommendedSize} vì ${metric.map((m) => `${m.label} ${m.value}`).join(' · ')} phù hợp với phom ${fit}.`;

  return {
    recommendedSize,
    reason: `${reasonText} Chọn ${recommendedSize} làm gợi ý chủ đạo; nếu bạn thích mặc ${fit === 'ôm' ? 'bám hơn' : fit === 'rộng' ? 'thoải mái hơn' : 'vừa vặn hơn'}, có thể cân nhắc ${sizes[clamp(idx + (fit === 'rộng' ? 1 : fit === 'ôm' ? -1 : 0), 0, sizes.length - 1)] || recommendedSize}.`,
    alternatives,
    needsMoreData: !hasBody || (!profile.chestCm && !profile.waistCm && !profile.heightCm),
    note: 'Chiều cao và cân nặng chỉ là tham khảo. Bảng đo sản phẩm và chiếc áo đang mặc sẽ quyết định tốt hơn khi mua.',
  };
}
