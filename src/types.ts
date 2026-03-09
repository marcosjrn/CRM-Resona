export type AccountType = 'Lead' | 'Cliente';
export type AcquisitionChannel = 'Indicação' | 'Inbound' | 'Outbound' | 'Comunidade' | 'Outro';
export type AccountStatus = 'Ativo' | 'Pausado' | 'Encerrado';
export type HealthStatus = 'Verde' | 'Amarelo' | 'Vermelho';

export interface Account {
  id: string;
  type: AccountType;
  company_name: string;
  segment: string;
  acquisition_channel: AcquisitionChannel;
  status?: AccountStatus;
  owner: string;
  contact_name?: string;
  contact_email?: string;
  contact_whatsapp?: string;
  notes?: string;
  tags?: string;
  health?: HealthStatus;
  mrr?: number;
  potential_value?: number;
  created_at: string;
  updated_at: string;
  // Latest deal fields (joined from server)
  latest_deal_stage?: string;
  latest_deal_next_action?: string;
  latest_deal_next_action_date?: string;
}

export type DealStage = string;

export interface Deal {
  id: string;
  account_id: string;
  company_name?: string;
  stage: string;
  next_action: string;
  next_action_date: string;
  loss_reason?: string;
  loss_notes?: string;
  created_at: string;
  updated_at: string;
}

export type InvoiceStatus = 'Pendente' | 'Pago' | 'Atrasado';
export type RevenueType = 'Implementacao' | 'Mensalidade';

export interface Invoice {
  id: string;
  account_id: string;
  company_name?: string;
  revenue_type: RevenueType;
  competence_month: string;
  due_date: string;
  amount: number;
  status: InvoiceStatus;
  paid_date?: string;
  created_at: string;
  updated_at: string;
}

export type CostCategory = 'Ferramentas' | 'Terceiros' | 'Mídia' | 'Horas' | 'Outros';

export interface Cost {
  id: string;
  account_id?: string;
  company_name?: string;
  name?: string;
  competence_month: string;
  category: CostCategory;
  amount: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: string;
  account_id: string;
  type: string;
  description: string;
  created_at: string;
}
