export type OfferKind = 'welcome' | 'birthday' | 'anniversary';
export type OfferStatus = 'active' | 'used' | 'expired' | 'upcoming';

export const offerKindNames: Record<OfferKind, string> = {
  welcome: 'Ưu đãi chào mừng',
  birthday: 'Ưu đãi sinh nhật',
  anniversary: 'Ưu đãi kỷ niệm',
};

export type MemberOffer = {
  id: string;
  kind: OfferKind;
  code: string;
  percent: number;
  max_discount: number;
  minimum: number;
  starts_at: string;
  expires_at: string;
  used_at: string | null;
  milestone: number;
  status: OfferStatus;
};

export type BirthdayState = {
  eligible: boolean;
  reasons: string[];
  in_welcome_window: boolean;
  birthday_date: string | null;
  claimed: boolean;
};

export type MyOffers = {
  offers: MemberOffer[];
  birthday: BirthdayState;
  phone: { e164: string | null; verified: boolean };
};

export type AppliedOffer = {
  code: string;
  source: 'member_offer' | 'coupon';
  kind: string;
  percent: number;
  max_discount?: number;
  minimum: number;
  discount: number;
  expires_at?: string;
  stackable: boolean;
};

export type OfferConfig = {
  id: string;
  kind: OfferKind;
  milestone: number;
  percent: number;
  max_discount: number;
  minimum: number;
  valid_days: number;
  active: number;
  updated_at: string;
};

export type OfferConfigInput = {
  percent: number;
  max_discount: number;
  minimum: number;
  valid_days: number;
  active: number;
};

export type OfferHistoryRow = {
  id: string;
  config_id: string;
  actor_id: string;
  actor_name: string | null;
  created_at: string;
  snapshot: { action: string; before: Partial<OfferConfig> | null; after: Partial<OfferConfig> | null };
};

export type IssuedOffer = MemberOffer & { member_id: string; member_name: string | null; email: string | null };

export type Profile = {
  id: string;
  name: string;
  email: string;
  role: string;
  phone_e164: string | null;
  phone_verified: number;
  phone_verified_at: string | null;
  birthday: string | null;
  birthday_updated_at: string | null;
  created_at: string;
};

export function offerTitle(o: { kind: OfferKind | string; milestone?: number }) {
  const base = offerKindNames[o.kind as OfferKind] || 'Ưu đãi thành viên';
  return o.kind === 'anniversary' && o.milestone ? `${base} ${o.milestone} năm` : base;
}
