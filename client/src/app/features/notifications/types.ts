export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string;
  ref_key?: string;
  read_at: string | null;
  created_at: string;
};
