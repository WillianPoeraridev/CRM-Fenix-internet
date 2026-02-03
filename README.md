# CRM Fênix 2.0 (MVP)

CRM Fênix 2.0 é a base inicial de um CRM web focado em operações comerciais, com navegação estruturada, autenticação e páginas principais em modo skeleton para acelerar a evolução do produto.

**Stack**
- Next.js (App Router) + TypeScript
- Tailwind CSS
- shadcn/ui (componentes base)
- Supabase Auth (@supabase/supabase-js)

**Rodando localmente**
1. Instale as dependências:
```bash
npm install
```
2. Configure as variáveis de ambiente:
```bash
cp .env.example .env.local
```
Preencha os valores em `.env.local` com as credenciais do seu projeto Supabase.

3. Suba o servidor de desenvolvimento:
```bash
npm run dev
```
Abra o app em:
```text
http://localhost:3000
```

**Observação**
As migrations e seeds do banco serão adicionadas no próximo passo.
