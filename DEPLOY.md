# Deploy na Vercel

Este é um monorepo (Turborepo + pnpm) com **duas** aplicações Next.js:

| App       | Pasta          | O que é                        |
| --------- | -------------- | ------------------------------ |
| `cliente` | `apps/cliente` | Marcação online (público, PWA) |
| `admin`   | `apps/admin`   | Painel de gestão (com login)   |

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

3. **Ter o código no GitHub** (`git push`)..

---

## 1. Criar o projeto do cliente

Na Vercel: **Add New → Project** → importar o repositório `gestor-servicos`.

| Campo              | Valor                                 |
| ------------------ | ------------------------------------- |
| Project Name       | `gestor-servicos-cliente` (à escolha) |
| Framework Preset   | Next.js (detetado automaticamente)    |
| **Root Directory** | `apps/cliente`                        |
| Build / Install    | deixar os valores por omissão         |

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

| Campo              | Valor                   |
| ------------------ | ----------------------- |
| Project Name       | `gestor-servicos-admin` |
| **Root Directory** | `apps/admin`            |

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

### Proteção das variáveis de ambiente

**A única fronteira que importa é o prefixo `NEXT_PUBLIC_`:**

- **Com** prefixo → o valor é _inlined_ no JavaScript enviado ao browser
  durante o build. Fica visível a qualquer pessoa (ver código-fonte da página).
  **Nenhuma opção da Vercel o pode esconder.**
- **Sem** prefixo → existe apenas no runtime do servidor; nunca chega ao browser.

Por isso: um segredo com prefixo `NEXT_PUBLIC_` é um segredo exposto. Não há
meio-termo.

#### Marcar como _Sensitive_ na Vercel

Ao criar a variável, a Vercel oferece a opção **Sensitive**: o valor passa a ser
apenas de escrita — não volta a poder ser lido no painel, na API nem no CLI.
Protege contra alguém com acesso ao painel (ou uma sessão roubada) conseguir
copiar a chave.

> Guarde uma cópia num gestor de palavras-passe: uma variável _Sensitive_ não
> pode ser consultada depois de gravada, só substituída.

#### Matriz — app `cliente` (`apps/cliente`)

| Variável                       | Vai ao browser?  | _Sensitive_ | Ambientes         |
| ------------------------------ | ---------------- | ----------- | ----------------- |
| `NEXT_PUBLIC_SUPABASE_URL`     | Sim (por design) | Não         | Production        |
| `SUPABASE_SECRET_KEY`          | **Não**          | **Sim** ✅  | Production        |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Sim (por design) | Não         | Production        |
| `VAPID_PRIVATE_KEY`            | **Não**          | **Sim** ✅  | Production        |
| `VAPID_SUBJECT`                | Não              | Não         | Production        |
| `TZ=Europe/Lisbon`             | Não              | Não         | Production        |

`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` **não é necessária nesta app**: o cliente
não usa nenhum cliente Supabase no browser — tudo passa por _server actions_.
(Só será preciso se algum dia usar `createBrowserSupabaseClient` aqui.)

#### Matriz — app `admin` (`apps/admin`)

As mesmas seis linhas acima, **mais**:

| Variável                               | Vai ao browser?               | _Sensitive_ | Porque é necessária          |
| -------------------------------------- | ----------------------------- | ----------- | ---------------------------- |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Sim (por design, RLS protege) | Não         | login e realtime no browser  |
| `NEXT_PUBLIC_CLIENTE_URL`              | Sim                           | Não         | links das notificações push  |

**Resumo: só duas variáveis por app precisam de _Sensitive_** —
`SUPABASE_SECRET_KEY` e `VAPID_PRIVATE_KEY`. As `NEXT_PUBLIC_*` são públicas por
natureza e marcá-las como _Sensitive_ não produz efeito nenhum.

#### Ambientes (Production / Preview / Development)

- **Development**: não é preciso ativar — o desenvolvimento local usa os
  ficheiros `.env.local`. Só faz sentido se usar `vercel env pull`.
- **Preview** ⚠️ : cada branch/PR gera um URL público. Se der a chave secreta ao
  ambiente _Preview_, esse URL é uma aplicação totalmente funcional a escrever
  na base de dados **real**. Escolha uma das opções:
  1. **Deployment Protection** (Settings → Deployment Protection →
     _Vercel Authentication_) para que os previews exijam login na Vercel; ou
  2. um **projeto Supabase separado** para _Preview_, com as suas próprias chaves.

  Se não usar previews, deixe as variáveis apenas em _Production_.

### Chave secreta e âmbito de risco

As duas apps acedem aos dados com a chave secreta, que **ignora o RLS**. É usada
apenas no servidor, mas implica que a segurança depende da validação feita nas
_server actions_ — e na app do cliente, que é pública, o âmbito de risco é maior.

Endurecimento futuro (refactor, não urgente): escrever políticas RLS adequadas e
passar a app do cliente a usar a chave _publishable_, deixando a chave secreta
exclusivamente no admin.

### Rotação de chaves

Antes de ir para produção a sério, rode as chaves que já circularam em texto
simples (ficheiros locais, conversas, capturas de ecrã):

- Supabase → _Settings → API_ (chaves do projeto).
- VAPID: gerar novo par e atualizar **as duas** apps em simultâneo — trocar as
  chaves invalida as subscrições push existentes.

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
