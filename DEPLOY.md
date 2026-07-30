# Deploy na Vercel

Este é um monorepo (Turborepo + pnpm) com **duas** aplicações Next.js:

| App           | Pasta          | O que é                          |
| ------------- | -------------- | -------------------------------- |
| `cliente`     | `apps/cliente` | Marcação online (público, PWA)   |
| `admin`       | `apps/admin`   | Painel de gestão (com login)     |

Na Vercel cria-se **um projeto por app**, ambos ligados ao mesmo repositório,
diferindo apenas na _Root Directory_.

---

## 0. Antes de começar (obrigatório)

1. **Aplicar as migrações SQL** no Supabase (SQL Editor), por ordem:
   - `packages/database/supabase/migrations/001_notificacoes_realtime.sql`
   - `packages/database/supabase/migrations/002_bloqueios_timestamptz.sql`

2. **Fechar o registo de novas contas no Supabase.** ⚠️ Ver a secção
   [Segurança](#segurança) — sem isto, qualquer pessoa pode criar conta e
   entrar no painel de administração.

3. **Ter o código no GitHub** (`git push`).

---

## 1. Criar o projeto do cliente

Na Vercel: **Add New → Project** → importar o repositório `gestor-servicos`.

| Campo               | Valor                                  |
| ------------------- | -------------------------------------- |
| Project Name        | `gestor-servicos-cliente` (à escolha)  |
| Framework Preset    | Next.js (detetado automaticamente)     |
| **Root Directory**  | `apps/cliente`                         |
| Build / Install     | deixar os valores por omissão          |

A Vercel deteta o workspace pnpm e o Turborepo sozinha: instala na raiz do
repositório e compila apenas esta app.

### Variáveis de ambiente (Settings → Environment Variables)

```
NEXT_PUBLIC_SUPABASE_URL=https://<projeto>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
NEXT_PUBLIC_VAPID_PUBLIC_KEY=B...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:o-seu-email@dominio.pt
```

Aplicar a _Production_, _Preview_ e _Development_.

---

## 2. Criar o projeto do admin

Repetir o processo, importando **o mesmo repositório**:

| Campo               | Valor                                |
| ------------------- | ------------------------------------ |
| Project Name        | `gestor-servicos-admin`              |
| **Root Directory**  | `apps/admin`                         |

### Variáveis de ambiente

As mesmas seis do cliente, **mais** o URL público do cliente (usado nos links
das notificações push):

```
NEXT_PUBLIC_CLIENTE_URL=https://<url-do-projeto-cliente>.vercel.app
```

> Este valor só é conhecido depois do primeiro deploy do cliente. Defina-o
> depois e faça _Redeploy_ do admin.

⚠️ A chave `NEXT_PUBLIC_VAPID_PUBLIC_KEY` tem de ser **exatamente a mesma** nas
duas apps — se diferirem, as notificações são recusadas pelo browser.

---

## 3. Depois do primeiro deploy

1. **Preencher `NEXT_PUBLIC_CLIENTE_URL`** no admin (ver acima) e fazer _Redeploy_.
2. **Criar o utilizador admin** no Supabase → _Authentication → Users → Add user_
   (com "Auto Confirm User"), se ainda não existir.
3. **Supabase → Authentication → URL Configuration**: colocar o URL do admin em
   _Site URL_ (necessário para emails de recuperação de palavra-passe).
4. **Testar as notificações push.** Em produção há HTTPS, por isso passam a
   funcionar coisas que em `http://` na rede local falham (web push e o botão
   "Copiar link").

---

## Segurança

### ⚠️ Fechar o registo de contas (crítico)

O `middleware.ts` do admin autoriza **qualquer utilizador autenticado**. Se o
registo público estiver ativo no Supabase, qualquer pessoa pode criar uma conta
e obter acesso total ao painel.

Em **Supabase → Authentication → Sign In / Providers → Email**, desligar
_"Allow new users to sign up"_. Crie os utilizadores admin manualmente.

Alternativa (defesa em profundidade): restringir por email em
`apps/admin/lib/auth.ts`, dentro de `requireUser()`.

### Chaves

- `SUPABASE_SECRET_KEY` e `VAPID_PRIVATE_KEY` **nunca** devem ter o prefixo
  `NEXT_PUBLIC_` — só assim ficam no servidor.
- As apps acedem aos dados com a chave secreta (que ignora o RLS), pelo que a
  segurança depende da validação feita nas _server actions_. Não expor essas
  ações a parâmetros não validados.
- Se alguma chave tiver sido partilhada por engano, rode-a em
  Supabase → _Settings → API_.

---

## Notas úteis

- **Domínios próprios**: cada projeto pode ter o seu (ex.: `reservas.dominio.pt`
  para o cliente e `admin.dominio.pt` para o admin). Depois de os configurar,
  atualizar `NEXT_PUBLIC_CLIENTE_URL`.
- **Fuso horário**: os horários são calculados no servidor. Os servidores da
  Vercel correm em UTC; para o negócio em Portugal, definir a variável de
  ambiente `TZ=Europe/Lisbon` em **ambos** os projetos.
- **`ignoreBuildErrors`**: ambos os `next.config.mjs` têm
  `typescript.ignoreBuildErrors: true`, pelo que um erro de tipos não faz falhar
  o deploy. Corra `pnpm typecheck` antes de publicar (ou remova a flag).
- **Custos**: o plano gratuito ("Hobby") da Vercel cobre dois projetos sem
  problema, mas é apenas para uso não-comercial.
