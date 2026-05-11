// Data layer backed by Lovable Cloud (Supabase). Keeps a similar shape to the
// previous local mock so existing pages render with minimal changes.
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ServiceType =
  | "Guincho urbano" | "Guincho viagem" | "Mecânica" | "Chaveiro"
  | "Bateria" | "Pane seca" | "Outros";
export type PaymentMethod = "Pix" | "Dinheiro" | "Cartão" | "Transferência";
export type ServiceStatus = "Pendente" | "Em andamento" | "Finalizado" | "Cancelado";

export interface Service {
  id: string; numero: string; cliente: string; telefone: string; origem: string; destino: string;
  tipo: ServiceType; valor: number; pagamento: PaymentMethod; km: number;
  motoristaId?: string | null; veiculoId?: string | null;
  status: ServiceStatus; data: string; obs?: string | null;
  via?: string | null;
  contaId?: string | null; comissaoPct?: number; comissaoValor?: number;
  placa?: string | null; veiculoModelo?: string | null;
}
export interface Account {
  id: string; nome: string; pixKey?: string | null; qrPath?: string | null; ativa: boolean;
  banco?: string | null; numeroConta?: string | null; telefoneResponsavel?: string | null;
}
export interface Client {
  id: string; nome: string; telefone: string; documento: string; endereco: string; obs?: string | null;
}
export interface Driver {
  id: string; nome: string; telefone: string; cnh: string; categoria: string;
  ativo: boolean; comissaoPct: number; comissaoValor: number;
}
export interface Vehicle {
  id: string; modelo: string; placa: string; km: number;
  consumoMedio: number; proximaManutencaoKm: number;
  marca?: string | null; cor?: string | null;
}
export type ExpenseCategory =
  | "Comissão" | "Combustível" | "Alimentação" | "Pedágio" | "Oficina" | "Peças"
  | "Manutenção" | "Funcionários" | "Internet" | "Energia" | "Outros";
export interface Expense {
  id: string; tipo: ExpenseCategory; valor: number; data: string;
  responsavel: string; obs?: string | null; via?: string | null;
  motoristaId?: string | null;
  servicoId?: string | null;
  pago: boolean;
  dataPagamento?: string | null;
}

interface DB {
  services: Service[]; clients: Client[]; drivers: Driver[];
  vehicles: Vehicle[]; expenses: Expense[]; accounts: Account[]; loading: boolean;
}

export function brl(n: number) {
  return (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

// ---- mappers ----
const mapService = (r: any): Service => ({
  id: r.id, numero: r.numero ?? "", cliente: r.cliente, telefone: r.telefone ?? "", origem: r.origem ?? "",
  destino: r.destino ?? "", tipo: r.tipo, valor: Number(r.valor), pagamento: r.pagamento,
  km: Number(r.km), motoristaId: r.motorista_id, veiculoId: r.veiculo_id,
  status: r.status, data: r.data, obs: r.obs, via: r.via ?? null,
  contaId: r.conta_id ?? null, comissaoPct: Number(r.comissao_pct ?? 0),
  comissaoValor: Number(r.comissao_valor ?? 0),
  placa: r.placa ?? null, veiculoModelo: r.veiculo_modelo ?? null,
});
const mapAccount = (r: any): Account => ({
  id: r.id, nome: r.nome, pixKey: r.pix_key ?? null, qrPath: r.qr_path ?? null, ativa: r.ativa,
  banco: r.banco ?? null, numeroConta: r.numero_conta ?? null, telefoneResponsavel: r.telefone_responsavel ?? null,
});
const mapDriver = (r: any): Driver => ({
  id: r.id, nome: r.nome, telefone: r.telefone ?? "", cnh: r.cnh ?? "",
  categoria: r.categoria ?? "", ativo: r.ativo,
  comissaoPct: Number(r.comissao_pct ?? 0),
  comissaoValor: Number(r.comissao_valor ?? 0),
});
const mapVehicle = (r: any): Vehicle => ({
  id: r.id, modelo: r.modelo, placa: r.placa, km: r.km,
  consumoMedio: Number(r.consumo_medio), proximaManutencaoKm: r.proxima_manutencao_km,
  marca: r.marca ?? null, cor: r.cor ?? null,
});
const mapExpense = (r: any): Expense => ({
  id: r.id, tipo: r.tipo, valor: Number(r.valor), data: r.data,
  responsavel: r.responsavel ?? "", obs: r.obs, via: r.via ?? null,
  motoristaId: r.motorista_id ?? null,
  servicoId: r.servico_id ?? null,
  pago: r.pago !== false,
  dataPagamento: r.data_pagamento ?? null,
});

const empty: DB = { services: [], clients: [], drivers: [], vehicles: [], expenses: [], accounts: [], loading: true };

export function useDB(): DB {
  const [data, setData] = useState<DB>(empty);

  const refresh = useCallback(async () => {
    const [s, c, d, v, e, a] = await Promise.all([
      supabase.from("servicos").select("*").order("data", { ascending: false }),
      supabase.from("clientes").select("*").order("nome"),
      supabase.from("motoristas").select("*").order("nome"),
      supabase.from("veiculos").select("*").order("modelo"),
      supabase.from("despesas").select("*").order("data", { ascending: false }),
      supabase.from("contas").select("*").order("nome"),
    ]);
    setData({
      services: (s.data ?? []).map(mapService),
      clients: (c.data ?? []) as any,
      drivers: (d.data ?? []).map(mapDriver),
      vehicles: (v.data ?? []).map(mapVehicle),
      expenses: (e.data ?? []).map(mapExpense),
      accounts: (a.data ?? []).map(mapAccount),
      loading: false,
    });
  }, []);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener("rmpi:db", handler);
    const channel = supabase
      .channel(`rmpi-db-${Math.random().toString(36).slice(2, 9)}`)
      .on("postgres_changes", { event: "*", schema: "public" }, handler)
      .subscribe();
    return () => {
      window.removeEventListener("rmpi:db", handler);
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  return data;
}

function notify() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("rmpi:db"));
}

// ---- mutation API ----
export const api = {
  async addClient(input: Omit<Client, "id">) {
    const { error } = await supabase.from("clientes").insert(input);
    if (error) throw error; notify();
  },
  async addDriver(input: Omit<Driver, "id">) {
    const { error } = await supabase.from("motoristas").insert({
      nome: input.nome, telefone: input.telefone, cnh: input.cnh, categoria: input.categoria,
      ativo: input.ativo, comissao_pct: input.comissaoPct, comissao_valor: input.comissaoValor ?? 0,
    });
    if (error) throw error; notify();
  },
  async addVehicle(input: Omit<Vehicle, "id">) {
    const { error } = await supabase.from("veiculos").insert({
      modelo: input.modelo, placa: input.placa, km: input.km,
      consumo_medio: input.consumoMedio, proxima_manutencao_km: input.proximaManutencaoKm,
      marca: input.marca ?? null, cor: input.cor ?? null,
    });
    if (error) throw error; notify();
  },
  async updateVehicle(id: string, input: Partial<Omit<Vehicle, "id">>) {
    const patch: any = {};
    if (input.modelo !== undefined) patch.modelo = input.modelo;
    if (input.placa !== undefined) patch.placa = input.placa;
    if (input.km !== undefined) patch.km = input.km;
    if (input.consumoMedio !== undefined) patch.consumo_medio = input.consumoMedio;
    if (input.proximaManutencaoKm !== undefined) patch.proxima_manutencao_km = input.proximaManutencaoKm;
    if (input.marca !== undefined) patch.marca = input.marca ?? null;
    if (input.cor !== undefined) patch.cor = input.cor ?? null;
    const { error } = await supabase.from("veiculos").update(patch).eq("id", id);
    if (error) throw error; notify();
  },
  async deleteVehicle(id: string) {
    const { error } = await supabase.from("veiculos").delete().eq("id", id);
    if (error) throw error; notify();
  },
  async addExpense(input: Partial<Expense> & { tipo: ExpenseCategory; valor: number; responsavel: string }): Promise<string> {
    const { data, error } = await supabase.from("despesas").insert({
      tipo: input.tipo, valor: input.valor,
      data: input.data ?? new Date().toISOString(),
      responsavel: input.responsavel, obs: input.obs ?? null,
      motorista_id: input.motoristaId ?? null,
      pago: input.pago ?? true,
      data_pagamento: input.pago === false ? null : (input.dataPagamento ?? new Date().toISOString()),
    }).select("id").single();
    if (error) throw error; notify();
    return data!.id as string;
  },
  async markExpensePaid(id: string, pago: boolean) {
    const { error } = await supabase.from("despesas").update({
      pago,
      data_pagamento: pago ? new Date().toISOString() : null,
    }).eq("id", id);
    if (error) throw error; notify();
  },
  async deleteExpense(id: string) {
    const { error } = await supabase.from("despesas").delete().eq("id", id);
    if (error) throw error; notify();
  },
  async addService(input: Omit<Service, "id" | "numero">): Promise<string> {
    const { data, error } = await supabase.from("servicos").insert({
      cliente: input.cliente, telefone: input.telefone, origem: input.origem, destino: input.destino,
      tipo: input.tipo, valor: input.valor, pagamento: input.pagamento, km: input.km,
      motorista_id: input.motoristaId || null, veiculo_id: input.veiculoId || null,
      status: input.status, data: input.data, obs: input.obs ?? null,
      conta_id: input.contaId || null,
      comissao_pct: input.comissaoPct ?? 0,
      comissao_valor: input.comissaoValor ?? 0,
      placa: input.placa ?? null, veiculo_modelo: input.veiculoModelo ?? null,
    }).select("id").single();
    if (error) throw error; notify();
    return data!.id as string;
  },
  async updateServiceStatus(id: string, status: ServiceStatus) {
    const { error } = await supabase.from("servicos").update({ status }).eq("id", id);
    if (error) throw error; notify();
  },
  async updateClient(id: string, input: Partial<Omit<Client, "id">>) {
    const { error } = await supabase.from("clientes").update(input).eq("id", id);
    if (error) throw error; notify();
  },
  async deleteClient(id: string) {
    const { error } = await supabase.from("clientes").delete().eq("id", id);
    if (error) throw error; notify();
  },
  async updateDriver(id: string, input: Partial<Omit<Driver, "id">>) {
    const patch: any = {};
    if (input.nome !== undefined) patch.nome = input.nome;
    if (input.telefone !== undefined) patch.telefone = input.telefone;
    if (input.cnh !== undefined) patch.cnh = input.cnh;
    if (input.categoria !== undefined) patch.categoria = input.categoria;
    if (input.ativo !== undefined) patch.ativo = input.ativo;
    if (input.comissaoPct !== undefined) patch.comissao_pct = input.comissaoPct;
    if (input.comissaoValor !== undefined) patch.comissao_valor = input.comissaoValor;
    const { error } = await supabase.from("motoristas").update(patch).eq("id", id);
    if (error) throw error; notify();
  },
  async deleteDriver(id: string) {
    const { error } = await supabase.from("motoristas").delete().eq("id", id);
    if (error) throw error; notify();
  },
  async updateService(id: string, input: Partial<Omit<Service, "id">>) {
    const patch: any = {};
    if (input.cliente !== undefined) patch.cliente = input.cliente;
    if (input.telefone !== undefined) patch.telefone = input.telefone;
    if (input.origem !== undefined) patch.origem = input.origem;
    if (input.destino !== undefined) patch.destino = input.destino;
    if (input.tipo !== undefined) patch.tipo = input.tipo;
    if (input.valor !== undefined) patch.valor = input.valor;
    if (input.pagamento !== undefined) patch.pagamento = input.pagamento;
    if (input.km !== undefined) patch.km = input.km;
    if (input.motoristaId !== undefined) patch.motorista_id = input.motoristaId || null;
    if (input.veiculoId !== undefined) patch.veiculo_id = input.veiculoId || null;
    if (input.status !== undefined) patch.status = input.status;
    if (input.data !== undefined) patch.data = input.data;
    if (input.obs !== undefined) patch.obs = input.obs ?? null;
    if (input.contaId !== undefined) patch.conta_id = input.contaId || null;
    if (input.comissaoPct !== undefined) patch.comissao_pct = input.comissaoPct;
    if (input.comissaoValor !== undefined) patch.comissao_valor = input.comissaoValor;
    if (input.placa !== undefined) patch.placa = input.placa ?? null;
    if (input.veiculoModelo !== undefined) patch.veiculo_modelo = input.veiculoModelo ?? null;
    const { error } = await supabase.from("servicos").update(patch).eq("id", id);
    if (error) throw error; notify();
  },
  async deleteService(id: string) {
    const { error } = await supabase.from("servicos").delete().eq("id", id);
    if (error) throw error; notify();
  },
  async addAccount(input: Omit<Account, "id">) {
    const { data, error } = await supabase.from("contas").insert({
      nome: input.nome, pix_key: input.pixKey ?? null, qr_path: input.qrPath ?? null, ativa: input.ativa,
      banco: input.banco ?? null, numero_conta: input.numeroConta ?? null, telefone_responsavel: input.telefoneResponsavel ?? null,
    }).select("id").single();
    if (error) throw error; notify();
    return data!.id as string;
  },
  async updateAccount(id: string, input: Partial<Omit<Account, "id">>) {
    const patch: any = {};
    if (input.nome !== undefined) patch.nome = input.nome;
    if (input.pixKey !== undefined) patch.pix_key = input.pixKey ?? null;
    if (input.qrPath !== undefined) patch.qr_path = input.qrPath ?? null;
    if (input.ativa !== undefined) patch.ativa = input.ativa;
    if (input.banco !== undefined) patch.banco = input.banco ?? null;
    if (input.numeroConta !== undefined) patch.numero_conta = input.numeroConta ?? null;
    if (input.telefoneResponsavel !== undefined) patch.telefone_responsavel = input.telefoneResponsavel ?? null;
    const { error } = await supabase.from("contas").update(patch).eq("id", id);
    if (error) throw error; notify();
  },
  async deleteAccount(id: string) {
    const { error } = await supabase.from("contas").delete().eq("id", id);
    if (error) throw error; notify();
  },
  qrPublicUrl(path: string | null | undefined): string | null {
    if (!path) return null;
    return supabase.storage.from("contas-qr").getPublicUrl(path).data.publicUrl;
  },
};
