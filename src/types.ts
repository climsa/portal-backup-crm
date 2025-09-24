// File: src/types.ts
// Ini adalah sumber kebenaran tunggal untuk semua bentuk data di aplikasi kita.

export interface DecodedToken {
  client: {
    id: string;
  };
}

export interface ClientData {
  client_id: string;
  company_name: string;
  email: string;
}

export interface CrmConnection {
  connection_id: string;
  crm_type: string;
  created_at: string;
  connection_name: string;
}

export interface BackupJob {
  job_id: string;
  connection_id: string;
  job_name: string;
  schedule: string;
  is_active: boolean;
  selected_data: { modules?: string[] };
}

export interface JobHistory {
  history_id: string;
  job_id: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  details: string | null;
  file_path: string | null;
}
