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
};

type City = {
  id: string;
  name: string;
  region_id: string;
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
  qnt: "1",
  tipo: "VENDA",
  status: "PENDENTE",
  city_id: "",
  bairro: "",
  nome_completo: "",
  contato: "",
};

const selectClassName =
  "flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2";

export default function CrmPage() {
  const [records, setRecords] = useState<CrmRecord[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);

  const cityMap = useMemo(() => {
    return new Map(cities.map((city) => [city.id, city.name]));
  }, [cities]);

  const loadRecords = async () => {
    const { data, error: recordsError } = await supabase
      .from("app.crm_records")
      .select(
        "id, data_registro, tipo, status, qnt, bairro, city_id, seller_id, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (recordsError) {
      throw recordsError;
    }

    setRecords((data as CrmRecord[]) || []);
  };

  const loadCities = async () => {
    const { data, error: citiesError } = await supabase
      .from("config.cities")
      .select("id, name, region_id")
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
        console.error(err);
        if (isMounted) {
          setError(
            "Nao foi possivel carregar os registros agora. Tente novamente."
          );
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

  const handleSave = async () => {
    try {
      setError(null);

      if (!userId) {
        setError("Sessao invalida. Faca login novamente.");
        return;
      }

      if (!form.data_registro || !form.city_id || !form.bairro) {
        setError("Preencha data, cidade e bairro.");
        return;
      }

      const qnt = Number(form.qnt);
      if (!Number.isFinite(qnt) || qnt <= 0) {
        setError("Quantidade precisa ser maior que zero.");
        return;
      }

      setSaving(true);

      const payload = {
        data_registro: form.data_registro,
        qnt,
        tipo: form.tipo,
        status: form.status,
        city_id: form.city_id,
        bairro: form.bairro.trim(),
        nome_completo: form.nome_completo.trim() || "",
        contato: form.contato.trim() || "",
        seller_id: userId,
      };

      const { data, error: insertError } = await supabase
        .from("app.crm_records")
        .insert(payload)
        .select(
          "id, data_registro, tipo, status, qnt, bairro, city_id, seller_id, created_at"
        )
        .single();

      if (insertError) {
        throw insertError;
      }

      if (data) {
        setRecords((prev) => [data as CrmRecord, ...prev].slice(0, 50));
      } else {
        await loadRecords();
      }

      setForm(initialForm);
      setShowForm(false);
    } catch (err) {
      console.error(err);
      setError("Nao foi possivel salvar o registro. Verifique os dados.");
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

      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
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
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">
                Quantidade
              </label>
              <Input
                type="number"
                min={1}
                value={form.qnt}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    qnt: event.target.value,
                  }))
                }
              />
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
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Qtd</th>
                <th className="px-4 py-3">Bairro</th>
                <th className="px-4 py-3">Cidade</th>
                <th className="px-4 py-3">Seller</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td className="px-4 py-4 text-slate-500" colSpan={7}>
                    Carregando...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-slate-500" colSpan={7}>
                    Nenhum registro encontrado.
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">{record.data_registro}</td>
                    <td className="px-4 py-3">{record.tipo}</td>
                    <td className="px-4 py-3">{record.status}</td>
                    <td className="px-4 py-3">{record.qnt}</td>
                    <td className="px-4 py-3">{record.bairro}</td>
                    <td className="px-4 py-3">
                      {cityMap.get(record.city_id) ?? "-"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {record.seller_id}
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
