# Configuração do Firebase

O app usa Firebase Authentication para contas e tokens de sessão assinados pelo Firebase, e Cloud Firestore para os dados. Não crie nem armazene JWTs ou chaves de serviço no navegador: a configuração web do Firebase é pública; a autorização dos dados é aplicada pelas regras em `firestore.rules`.

## Criar o projeto

1. Crie um projeto no [Firebase Console](https://console.firebase.google.com/) e escolha o plano Spark.
2. Em **Authentication → Sign-in method**, habilite **E-mail/senha** e, se disponível na configuração do projeto, a proteção contra enumeração de e-mails.
3. Em **Authentication → Settings → Authorized domains**, adicione `localhost` e o domínio onde o app será publicado.
4. Em **Firestore Database**, crie o banco de dados em modo de produção.
5. Registre um app Web no projeto e copie os valores da configuração para `.env.local`, usando [.env.example](./.env.example) como modelo. Não envie `.env.local` ao Git.

```sh
npm install
npm run dev
```

Variáveis necessárias: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID` e `VITE_FIREBASE_APP_ID`.

## Publicar regras e índices

Instale a Firebase CLI, autentique-se e associe o projeto:

```sh
npm install --global firebase-tools
firebase login
firebase use --add
firebase deploy --only firestore:rules,firestore:indexes
```

Para hospedar também no Firebase Hosting:

```sh
npm run build
firebase deploy --only hosting
```

O arquivo [firebase.json](./firebase.json) publica o diretório `dist` e habilita o fallback de rotas do app.

## Criar o primeiro administrador

Não há cadastro público de administrador. No Firebase Console:

1. Crie a conta do administrador em **Authentication → Users → Add user**.
2. Anote o UID e crie `profiles/{UID}` no Firestore com os campos:

```json
{
  "id": "UID_DA_CONTA",
  "matricula": "MATRICULA_DO_ADMINISTRADOR",
  "full_name": "NOME_DO_ADMINISTRADOR",
  "email": "EMAIL_DA_CONTA",
  "account_role": "administrador",
  "status": "approved",
  "created_at": "2026-01-01T00:00:00.000Z"
}
```

3. Crie `matriculas/{matricula-do-administrador}` com `{ "uid": "UID_DA_CONTA" }`.
4. Crie também `public_profiles/{UID_DA_CONTA}` com os campos `id` (UID), `full_name` (nome), `matricula`, `email`, `account_role` (`administrador`) e `status` (`approved`). Esse documento alimenta o diretório e deve conter o e-mail para que ele possa ser incluído no relatório.
5. Peça ao administrador para confirmar o e-mail antes de entrar.

Use a matrícula normalizada (minúsculas) como ID do documento em `matriculas`. Não crie perfil administrativo para contas que não controla.

## Fluxo de acesso

- Alunos e professores criam conta com e-mail, senha de no mínimo 12 caracteres, nome e matrícula.
- O Firebase envia um e-mail de confirmação. A pessoa deve confirmá-lo antes de acessar o app.
- Professores aprovados analisam solicitações de alunos; administradores aprovam professores.
- A matrícula passa a ser única quando uma solicitação é aprovada.
- Tokens de sessão são emitidos/renovados pelo Firebase Authentication. Não existe JWT fixo gerado no código.
- Usuários aprovados podem consultar o diretório com nome, matrícula, perfil, projetos e e-mail para relatórios configuráveis.
- Professores e administradores podem cadastrar projetos e links HTTPS para documentos. Alunos solicitam filiação; o conteúdo dos projetos fica disponível após a aprovação da solicitação.
- Na aba **Projetos**, alunos podem solicitar filiação diretamente no cartão ou na página do projeto; professores/administradores aprovam a solicitação.
- Perfis aprovados existentes recebem seu registro de diretório quando o usuário entrar novamente no app. Links externos devem ter as permissões de compartilhamento configuradas no serviço onde o arquivo está hospedado; as regras do Firestore controlam quem vê o link no app, não as permissões do arquivo externo.
- Após atualizar o app para exibir e-mails no PDF, publique as regras atualizadas com `firebase deploy --only firestore:rules`. Perfis de diretório existentes recebem/sincronizam o e-mail ao entrarem novamente.

## Variáveis do GitHub Pages

Se usar o workflow existente do GitHub Pages, cadastre os seis valores `VITE_FIREBASE_*` como **Actions secrets** em **Settings → Secrets and variables → Actions**. São configurações web públicas do Firebase, não chaves administrativas. Nunca adicione uma service-account key ao frontend.

## Limites e migração

O plano Spark tem cotas e condições que podem mudar; ele não garante serviço gratuito para sempre. Verifique os limites atuais do Firebase para Authentication, Firestore e Hosting. A Spark não oferece Cloud Functions: aprovações e reservas são feitas no app, mas não há envio automático de e-mail para reservas. O Firebase ainda envia mensagens próprias de confirmação e redefinição de senha.

Os registros existentes no Supabase não são importados automaticamente. Exporte e revise os dados antes de encerrar o projeto antigo; usuários precisarão criar contas Firebase, pois senhas e sessões não são migradas pelo app.
