"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CrmRecord = {
  id: string;
  data_registro: string;
  tipo: string;
  status: string;
  qnt: number;
  bairro: string;
  city_id: string;
  seller_id: string;
  created_at: string;
  nome_completo: string | null;
  contato: string | null;
};

type City = {
  id: string;
  name: string;
};

const tipoOptions = [
  "VENDA",
  "LEAD",
  "MIGRACAO",
  "INADIMPLENCIA",
  "REATIVACAO",
];

const statusOptions = [
  "PENDENTE",
  "AGENDADO",
  "REAGENDAR",
  "INSTALADO",
  "CANCELADO",
  "INVIAVEL",
];

const initialForm = {
  data_registro: "",
  tipo: "VENDA",
  status: "PENDENTE",
  city_id: "",
  bairro: "",
  nome_completo: "",
  contato: "",
};

const selectClassName =
  "flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2";

const toLocalDateISO = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDateInput = (value?: string | Date | null) => {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  const parts = value.split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts.map(Number);
    if (!Number.isNaN(year) && !Number.isNaN(month) && !Number.isNaN(day)) {
      return new Date(year, month - 1, day);
    }
  }
  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
};

const formatDateBR = (value?: string | Date | null) => {
  const date = parseDateInput(value);
  if (!date) {
    return "-";
  }
  return new Intl.DateTimeFormat("pt-BR").format(date);
};

const weekdayLong = (value?: string | Date | null) => {
  const date = parseDateInput(value);
  if (!date) {
    return "";
  }
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(date);
};

const weekdayShort = (value?: string | Date | null) => {
  const date = parseDateInput(value);
  if (!date) {
    return "";
  }
  const raw = new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(
    date
  );
  const cleaned = raw.replace(/\./g, "");
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
};

const abbreviateId = (value?: string | null) => {
  if (!value) {
    return "-";
  }
  if (value.length <= 8) {
    return value;
  }
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
};

const formatErrorDetails = (err: unknown) => {
  if (!err) {
    return null;
  }

  if (typeof err === "object") {
    const maybe = err as { status?: number; message?: string };
    const statusText =
      typeof maybe.status === "number" ? `status ${maybe.status}` : null;
    const messageText =
      typeof maybe.message === "string" ? maybe.message : null;

    if (statusText && messageText) {
      return `${statusText} - ${messageText}`;
    }
    if (statusText) {
      return statusText;
    }
    if (messageText) {
      return messageText;
    }
  }

  if (err instanceof Error) {
    return err.message;
  }

  return null;
};

export default function CrmPage() {
  const [records, setRecords] = useState<CrmRecord[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);
  const [sellerNameById, setSellerNameById] = useState<Map<string, string>>(
    new Map()
  );

  const cityMap = useMemo(() => {
    return new Map(cities.map((city) => [city.id, city.name]));
  }, [cities]);

  const loadRecords = async () => {
    const { data, error: recordsError } = await supabase
      .schema("app")
      .from("crm_records")
      .select(
        "id, data_registro, tipo, status, qnt, bairro, city_id, seller_id, created_at, nome_completo, contato"
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (recordsError) {
      throw recordsError;
    }

    const rows = (data as CrmRecord[]) || [];
    setRecords(rows);

    const sellerIds = Array.from(
      new Set(rows.map((row) => row.seller_id).filter(Boolean))
    );

    if (sellerIds.length === 0) {
      setSellerNameById(new Map());
      return;
    }

    const { data: profiles, error: profilesError } = await supabase
      .schema("app")
      .from("profiles")
      .select("id, full_name")
      .in("id", sellerIds);

    if (profilesError) {
      console.error("[CRM sellers]", profilesError);
      setSellerNameById(new Map());
      return;
    }

    const entries = (profiles || []).map((profile) => [
      profile.id,
      profile.full_name,
    ]);
    setSellerNameById(new Map(entries));
  };

  const loadCities = async () => {
    const { data, error: citiesError } = await supabase
      .schema("config")
      .from("cities")
      .select("id, name")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (citiesError) {
      throw citiesError;
    }

    setCities((data as City[]) || []);
  };

  useEffect(() => {
    let isMounted = true;

    const loadAll = async () => {
      try {
        setLoading(true);
        setError(null);
        setErrorDetails(null);

        const { data: userData, error: userError } =
          await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (isMounted) {
          setUserId(userData.user?.id ?? null);
        }

        await Promise.all([loadCities(), loadRecords()]);
      } catch (err) {
        console.error("[CRM load]", err);
        if (isMounted) {
          setError(
            "Nao foi possivel carregar os registros agora. Tente novamente."
          );
          setErrorDetails(formatErrorDetails(err));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadAll();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!showForm || form.data_registro) {
      return;
    }

    const todayISO = toLocalDateISO(new Date());
    setForm((prev) => ({
      ...prev,
      data_registro: prev.data_registro || todayISO,
    }));
  }, [showForm, form.data_registro]);

  const handleSave = async () => {
    try {
      setError(null);
      setErrorDetails(null);

      if (!userId) {
        setError("Sessao invalida. Faca login novamente.");
        return;
      }

      if (!form.data_registro || !form.city_id || !form.bairro) {
        setError("Preencha data, cidade e bairro.");
        return;
      }

      setSaving(true);

      const payload = {
        data_registro: form.data_registro,
        qnt: 1,
        tipo: form.tipo,
        status: form.status,
        city_id: form.city_id,
        bairro: form.bairro.trim(),
        nome_completo: form.nome_completo.trim() || null,
        contato: form.contato.trim() || null,
        seller_id: userId,
      };

      const { error: insertError } = await supabase
        .schema("app")
        .from("crm_records")
        .insert(payload)
        .select("id");

      if (insertError) {
        throw insertError;
      }

      setShowForm(false);
      setForm(initialForm);
      await loadRecords();
    } catch (err) {
      console.error("[CRM save]", err);
      setError("Nao foi possivel salvar o registro. Verifique os dados.");
      setErrorDetails(formatErrorDetails(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">CRM</h1>
          <p className="text-sm text-slate-500">
            Ultimos 50 registros ordenados por data de criacao.
          </p>
        </div>
        <Button onClick={() => setShowForm((prev) => !prev)}>
          {showForm ? "Fechar" : "Novo registro"}
        </Button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <span>Exibindo: {records.length} registros</span>
          <span>
            Total (soma qnt):{" "}
            {records.reduce((total, item) => total + (item.qnt || 0), 0)}
          </span>
          <span>
            Vendas: {records.filter((item) => item.tipo === "VENDA").length} |
            Leads: {records.filter((item) => item.tipo === "LEAD").length}
          </span>
          <span>
            Pendentes:{" "}
            {
              records.filter((item) =>
                ["PENDENTE", "AGENDADO", "REAGENDAR"].includes(item.status)
              ).length
            }{" "}
            | Concluidos:{" "}
            {
              records.filter((item) =>
                ["INSTALADO", "CANCELADO", "INVIAVEL"].includes(item.status)
              ).length
            }
          </span>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <div>{error}</div>
          {process.env.NODE_ENV !== "production" && errorDetails ? (
            <div className="mt-1 text-xs text-rose-600">{errorDetails}</div>
          ) : null}
        </div>
      ) : null}

      {showForm ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-slate-600">
                Data do registro
              </label>
              <Input
                type="date"
                value={form.data_registro}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    data_registro: event.target.value,
                  }))
                }
              />
              <span className="mt-1 block text-xs text-slate-500">
                {weekdayLong(form.data_registro) || "-"}
              </span>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Tipo</label>
              <select
                className={selectClassName}
                value={form.tipo}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    tipo: event.target.value,
                  }))
                }
              >
                {tipoOptions.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {tipo}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Status</label>
              <select
                className={selectClassName}
                value={form.status}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    status: event.target.value,
                  }))
                }
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Cidade</label>
              <select
                className={selectClassName}
                value={form.city_id}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    city_id: event.target.value,
                  }))
                }
              >
                <option value="">Selecione</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Bairro</label>
              <Input
                value={form.bairro}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    bairro: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">
                Nome completo (opcional)
              </label>
              <Input
                value={form.nome_completo}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    nome_completo: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">
                Contato (opcional)
              </label>
              <Input
                value={form.contato}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    contato: event.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowForm(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Contato</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Bairro</th>
                <th className="px-4 py-3">Cidade</th>
                <th className="px-4 py-3">Seller</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td className="px-4 py-4 text-slate-500" colSpan={8}>
                    Carregando...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-slate-500" colSpan={8}>
                    Nenhum registro encontrado.
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      {formatDateBR(record.data_registro) === "-"
                        ? "-"
                        : `${formatDateBR(record.data_registro)} (${weekdayShort(
                            record.data_registro
                          )})`}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="block max-w-[180px] truncate"
                        title={record.nome_completo || "-"}
                      >
                        {record.nome_completo || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="block max-w-[140px] truncate"
                        title={record.contato || "-"}
                      >
                        {record.contato || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3">{record.tipo}</td>
                    <td className="px-4 py-3">{record.status}</td>
                    <td className="px-4 py-3">{record.bairro}</td>
                    <td className="px-4 py-3">
                      {cityMap.get(record.city_id) ?? "-"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {record.seller_id === userId
                        ? "Você"
                        : sellerNameById.get(record.seller_id) ??
                          abbreviateId(record.seller_id)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
