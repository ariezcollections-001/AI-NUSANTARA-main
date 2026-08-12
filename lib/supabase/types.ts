export type UserRole = "user" | "founder";

export type TransactionStatus =
  | "pending"
  | "success"
  | "failed"
  | "expired"
  | "cancelled";

export interface User {
  id: string;
  email: string;
  role: UserRole;
  character_balance: number;
  device_fingerprint: string | null;
  created_at: string;
}

export interface AiSetting {
  id: number;
  feature_slug: string;
  feature_name: string;
  system_prompt: string;
  temperature: number;
  is_active: boolean;
  seo_title: string | null;
  seo_description: string | null;
}

export interface Founder {
  id: string;
  email: string;
  role: "founder";
  created_at: string;
}

export interface FounderConfig {
  id: number;
  key_name: string;
  key_value: string;
  updated_at: string;
}

export interface PricingPackage {
  id: number;
  package_name: string;
  price: number;
  character_amount: number;
  is_visible: boolean;
}

export interface Transaction {
  order_id: string;
  user_id: string;
  amount: number;
  status: TransactionStatus;
  created_at: string;
}

export interface SecurityLog {
  id: number;
  event_type: string;
  ip_address: string | null;
  details: Record<string, unknown> | null;
  timestamp: string;
}

export interface Database {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: Omit<User, "created_at"> & { created_at?: string };
        Update: Partial<Omit<User, "id">>;
      };
      ai_settings: {
        Row: AiSetting;
        Insert: Omit<AiSetting, "id"> & { id?: number };
        Update: Partial<Omit<AiSetting, "id">>;
      };
      founder: {
        Row: Founder;
        Insert: Omit<Founder, "created_at"> & { created_at?: string };
        Update: Partial<Omit<Founder, "id">>;
      };
      founder_config: {
        Row: FounderConfig;
        Insert: Omit<FounderConfig, "id" | "updated_at"> & {
          id?: number;
          updated_at?: string;
        };
        Update: Partial<Omit<FounderConfig, "id">>;
      };
      pricing_packages: {
        Row: PricingPackage;
        Insert: Omit<PricingPackage, "id"> & { id?: number };
        Update: Partial<Omit<PricingPackage, "id">>;
      };
      transactions: {
        Row: Transaction;
        Insert: Omit<Transaction, "created_at"> & { created_at?: string };
        Update: Partial<Omit<Transaction, "order_id">>;
      };
      security_logs: {
        Row: SecurityLog;
        Insert: Omit<SecurityLog, "id" | "timestamp"> & {
          id?: number;
          timestamp?: string;
        };
        Update: Partial<Omit<SecurityLog, "id">>;
      };
    };
  };
}
