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
  inviabilidade: string | null;
  cancel_subtype: string | null;
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
  { label: "VENDA", value: "VENDA" },
  { label: "LEAD", value: "LEAD" },
  { label: "MIGRAÇÃO", value: "MIGRACAO" },
  { label: "INADIMPLÊNCIA", value: "INADIMPLENCIA" },
  { label: "REATIVAÇÃO", value: "REATIVACAO" },
];

const planilhaStatusOptions = [
  { label: "SIM", value: "SIM" },
  { label: "NÃO", value: "NAO" },
  { label: "REAGENDAR", value: "REAGENDAR" },
  { label: "INV REGIÃO", value: "INV REGIAO" },
  { label: "INV PORTA", value: "INV PORTA" },
  { label: "CANCELADO", value: "CANCELADO" },
  { label: "CANC TRANBORDO", value: "CANC TRANBORDO" },
];

const initialForm = {
  data_registro: "",
  tipo: "VENDA",
  status: "SIM",
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

const planilhaStatusToDb = (status: string) => {
  switch (status) {
    case "SIM":
      return { status: "INSTALADO", inviabilidade: null, cancel_subtype: null };
    case "NAO":
      return { status: "PENDENTE", inviabilidade: null, cancel_subtype: null };
    case "REAGENDAR":
      return { status: "REAGENDAR", inviabilidade: null, cancel_subtype: null };
    case "INV REGIAO":
      return { status: "INVIAVEL", inviabilidade: "REGIAO", cancel_subtype: null };
    case "INV PORTA":
      return { status: "INVIAVEL", inviabilidade: "PORTA", cancel_subtype: null };
    case "CANCELADO":
      return { status: "CANCELADO", inviabilidade: null, cancel_subtype: null };
    case "CANC TRANBORDO":
      return {
        status: "CANCELADO",
        inviabilidade: null,
        cancel_subtype: "TRANBORDO",
      };
    default:
      return { status: "PENDENTE", inviabilidade: null, cancel_subtype: null };
  }
};

const dbToPlanilhaStatus = (record: CrmRecord) => {
  if (record.status === "INSTALADO") {
    return "SIM";
  }
  if (record.status === "PENDENTE") {
    return "NAO";
  }
  if (record.status === "REAGENDAR") {
    return "REAGENDAR";
  }
  if (record.status === "INVIAVEL") {
    return record.inviabilidade === "PORTA" ? "INV PORTA" : "INV REGIAO";
  }
  if (record.status === "CANCELADO") {
    return record.cancel_subtype === "TRANBORDO"
      ? "CANC TRANBORDO"
      : "CANCELADO";
  }
  return record.status;
};

const tipoLabel = (tipo: string) => {
  return tipoOptions.find((item) => item.value === tipo)?.label ?? tipo;
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
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [sellerNameById, setSellerNameById] = useState<Map<string, string>>(
    new Map()
  );
  const [editingId, setEditingId] = useState<string | null>(null);

  const cityMap = useMemo(() => {
    return new Map(cities.map((city) => [city.id, city.name]));
  }, [cities]);

  const loadRecords = async () => {
    const { data, error: recordsError } = await supabase
      .schema("app")
      .from("crm_records")
      .select(
        "id, data_registro, tipo, status, inviabilidade, cancel_subtype, qnt, bairro, city_id, seller_id, created_at, nome_completo, contato"
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

        const currentUserId = userData.user?.id ?? null;
        if (isMounted) {
          setUserId(currentUserId);
        }

        if (currentUserId) {
          const { data: profile, error: profileError } = await supabase
            .schema("app")
            .from("profiles")
            .select("id, role")
            .eq("id", currentUserId)
            .maybeSingle();

          if (profileError) {
            throw profileError;
          }

          if (isMounted) {
            setIsAdmin(profile?.role === "ADMIN");
          }
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

  const canEditRecord = (record: CrmRecord) =>
    record.seller_id === userId || isAdmin;

  const handleStartCreate = () => {
    if (showForm && !editingId) {
      setShowForm(false);
      setForm(initialForm);
      return;
    }

    setEditingId(null);
    setForm(initialForm);
    setShowForm(true);
  };

  const handleEdit = (record: CrmRecord) => {
    setEditingId(record.id);
    setForm({
      data_registro: record.data_registro,
      tipo: record.tipo,
      status: dbToPlanilhaStatus(record),
      city_id: record.city_id,
      bairro: record.bairro,
      nome_completo: record.nome_completo || "",
      contato: record.contato || "",
    });
    setShowForm(true);
  };

  const handleDelete = async (record: CrmRecord) => {
    if (!canEditRecord(record)) {
      setError("Sem permissao para excluir este registro.");
      return;
    }

    if (!confirm("Deseja excluir este registro?")) {
      return;
    }

    try {
      setUpdatingId(record.id);
      setError(null);
      setErrorDetails(null);

      const { error: deleteError } = await supabase
        .schema("app")
        .from("crm_records")
        .delete()
        .eq("id", record.id);

      if (deleteError) {
        throw deleteError;
      }

      setRecords((prev) => prev.filter((item) => item.id !== record.id));
    } catch (err) {
      console.error("[CRM delete]", err);
      setError("Nao foi possivel excluir o registro.");
      setErrorDetails(formatErrorDetails(err));
    } finally {
      setUpdatingId(null);
    }
  };

  const handleInlineStatusChange = async (
    record: CrmRecord,
    nextPlanilha: string
  ) => {
    if (!canEditRecord(record)) {
      setError("Sem permissao para editar este registro.");
      return;
    }

    const { status, inviabilidade, cancel_subtype } =
      planilhaStatusToDb(nextPlanilha);

    try {
      setUpdatingId(record.id);
      setError(null);
      setErrorDetails(null);

      const { error: updateError } = await supabase
        .schema("app")
        .from("crm_records")
        .update({ status, inviabilidade, cancel_subtype })
        .eq("id", record.id);

      if (updateError) {
        throw updateError;
      }

      setRecords((prev) =>
        prev.map((item) =>
          item.id === record.id
            ? { ...item, status, inviabilidade, cancel_subtype }
            : item
        )
      );
    } catch (err) {
      console.error("[CRM update]", err);
      setError("Nao foi possivel atualizar o status.");
      setErrorDetails(formatErrorDetails(err));
    } finally {
      setUpdatingId(null);
    }
  };

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

      const statusDb = planilhaStatusToDb(form.status);

      const payload = {
        data_registro: form.data_registro,
        qnt: 1,
        tipo: form.tipo,
        status: statusDb.status,
        inviabilidade: statusDb.inviabilidade,
        cancel_subtype: statusDb.cancel_subtype,
        city_id: form.city_id,
        bairro: form.bairro.trim(),
        nome_completo: form.nome_completo.trim() || null,
        contato: form.contato.trim() || null,
      };

      if (editingId) {
        const { error: updateError } = await supabase
          .schema("app")
          .from("crm_records")
          .update(payload)
          .eq("id", editingId);

        if (updateError) {
          throw updateError;
        }
      } else {
        const insertPayload = {
          ...payload,
          seller_id: userId,
        };

        const { error: insertError } = await supabase
          .schema("app")
          .from("crm_records")
          .insert(insertPayload)
          .select("id");

        if (insertError) {
          throw insertError;
        }
      }

      setShowForm(false);
      setForm(initialForm);
      setEditingId(null);
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
        <Button onClick={handleStartCreate}>
          {showForm && !editingId ? "Fechar" : "Novo registro"}
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
            Status:{" "}
            {planilhaStatusOptions
              .map((status) => {
                const count = records.filter(
                  (item) => dbToPlanilhaStatus(item) === status.value
                ).length;
                return `${status.label}: ${count}`;
              })
              .join(" | ")}
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
              <label className="text-xs font-medium text-slate-600">
                Definição
              </label>
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
                  <option key={tipo.value} value={tipo.value}>
                    {tipo.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">
                Status Planilha
              </label>
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
                {planilhaStatusOptions.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
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
              {saving
                ? "Salvando..."
                : editingId
                ? "Atualizar"
                : "Salvar"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
                setForm(initialForm);
              }}
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
                <th className="px-4 py-3">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td className="px-4 py-4 text-slate-500" colSpan={9}>
                    Carregando...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-slate-500" colSpan={9}>
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
                    <td className="px-4 py-3">{tipoLabel(record.tipo)}</td>
                    <td className="px-4 py-3">
                      <select
                        className={selectClassName}
                        value={dbToPlanilhaStatus(record)}
                        onChange={(event) =>
                          handleInlineStatusChange(record, event.target.value)
                        }
                        disabled={!canEditRecord(record) || updatingId === record.id}
                      >
                        {planilhaStatusOptions.map((status) => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                    </td>
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
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(record)}
                          disabled={!canEditRecord(record)}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(record)}
                          disabled={!canEditRecord(record) || updatingId === record.id}
                        >
                          Excluir
                        </Button>
                      </div>
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
