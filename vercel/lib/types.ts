export type Source = {
  id?: string;
  name: string;
  url: string;
  enabled?: boolean;
};

export type Signal = {
  source_name: string;
  source_url: string;
  title: string;
  link: string;
  published_at: string | null;
  airline: string | null;
  role: string | null;
  summary: string;
  confidence: "high" | "medium" | "low";
};

export type Draft = {
  draft_date: string;
  post: string;
  source_json: Signal[];
  status: string;
  approved: boolean;
  updated_at?: string;
};
