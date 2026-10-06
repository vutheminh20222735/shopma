CREATE TABLE IF NOT EXISTS site_banners (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL,
  mobile_image TEXT NOT NULL DEFAULT '',
  href TEXT NOT NULL DEFAULT '/',
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS member_body_profiles (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL UNIQUE,
  height_cm INTEGER,
  weight_kg INTEGER,
  fit_pref TEXT DEFAULT 'vừa',
  chest_cm INTEGER,
  waist_cm INTEGER,
  hip_cm INTEGER,
  shoulder_cm INTEGER,
  notes TEXT DEFAULT '',
  consent INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gift_boxes (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  variant_size TEXT NOT NULL,
  variant_color TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  total_amount INTEGER NOT NULL DEFAULT 0,
  address TEXT DEFAULT '',
  items_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
