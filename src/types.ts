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
}

export type DealStage = 'Novo' | 'Qualificação' | 'Diagnóstico agendado' | 'Proposta enviada' | 'Negociação' | 'Ganhou' | 'Perdido';

export interface Deal {
  id: string;
  account_id: string;
  company_name?: string;
  stage: DealStage;
  next_action: string;
  next_action_date: string;
  created_at: string;
  updated_at: string;
}

export type InvoiceStatus = 'Pendente' | 'Pago' | 'Atrasado';

export interface Invoice {
  id: string;
  account_id: string;
  company_name?: string;
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
