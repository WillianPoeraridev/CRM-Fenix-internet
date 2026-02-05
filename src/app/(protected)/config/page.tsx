"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Region = {
  id: string;
  name: string;
};

type City = {
  id: string;
  name: string;
  region_id: string;
  is_active: boolean;
};

export default function ConfigPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [cities, setCities] = useState<City[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const regionMap = useMemo(() => {
    return new Map(regions.map((region) => [region.id, region.name]));
  }, [regions]);

  const filteredCities = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return cities;
    }

    return cities.filter((city) => {
      const regionName = regionMap.get(city.region_id) ?? "";
      return (
        city.name.toLowerCase().includes(term) ||
        regionName.toLowerCase().includes(term)
      );
    });
  }, [cities, regionMap, search]);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: userData, error: userError } =
          await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        const userId = userData.user?.id;
        if (!userId) {
          throw new Error("Usuario nao autenticado.");
        }

        const { data: profile, error: profileError } = await supabase
          .schema("app")
          .from("profiles")
          .select("id, role")
          .eq("id", userId)
          .maybeSingle();

        if (profileError) {
          throw profileError;
        }

        if (isMounted) {
          setIsAdmin(profile?.role === "ADMIN");
        }

        const [regionsResult, citiesResult] = await Promise.all([
          supabase
            .schema("config")
            .from("regions")
            .select("id, name")
            .order("name", { ascending: true }),
          supabase
            .schema("config")
            .from("cities")
            .select("id, name, region_id, is_active")
            .order("name", { ascending: true }),
        ]);

        if (regionsResult.error) {
          throw regionsResult.error;
        }
        if (citiesResult.error) {
          throw citiesResult.error;
        }

        if (isMounted) {
          setRegions((regionsResult.data as Region[]) || []);
          setCities((citiesResult.data as City[]) || []);
        }
      } catch (err) {
        console.error("[CONFIG cities]", err);
        if (isMounted) {
          setError("Nao foi possivel carregar as cidades.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleToggle = async (city: City) => {
    if (!isAdmin || savingId) {
      return;
    }

    try {
      setSavingId(city.id);
      setError(null);

      const { data, error: updateError } = await supabase
        .schema("config")
        .from("cities")
        .update({ is_active: !city.is_active })
        .eq("id", city.id)
        .select("is_active")
        .maybeSingle();

      if (updateError) {
        throw updateError;
      }

      const nextActive =
        typeof data?.is_active === "boolean" ? data.is_active : !city.is_active;

      setCities((prev) =>
        prev.map((item) =>
          item.id === city.id ? { ...item, is_active: nextActive } : item
        )
      );
    } catch (err) {
      console.error("[CONFIG toggle]", err);
      setError("Nao foi possivel atualizar a cidade.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Configuracoes (Admin)
        </h1>
        <p className="text-sm text-slate-500">
          Gestao de cidades e regioes para o CRM.
        </p>
      </div>

      {!isAdmin ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Sem permissao para editar. Voce pode apenas visualizar as cidades.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-slate-600">
          Total de cidades: {cities.length}
        </div>
        <div className="w-full sm:w-72">
          <Input
            placeholder="Buscar cidade ou regiao..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Cidade</th>
                <th className="px-4 py-3">Regiao</th>
                <th className="px-4 py-3">Ativo</th>
                <th className="px-4 py-3">Acao</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td className="px-4 py-4 text-slate-500" colSpan={4}>
                    Carregando...
                  </td>
                </tr>
              ) : filteredCities.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-slate-500" colSpan={4}>
                    Nenhuma cidade encontrada.
                  </td>
                </tr>
              ) : (
                filteredCities.map((city) => (
                  <tr key={city.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">{city.name}</td>
                    <td className="px-4 py-3">
                      {regionMap.get(city.region_id) ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      {city.is_active ? "Ativo" : "Inativo"}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggle(city)}
                        disabled={!isAdmin || savingId === city.id}
                      >
                        {savingId === city.id
                          ? "Salvando..."
                          : city.is_active
                          ? "Desativar"
                          : "Ativar"}
                      </Button>
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
