# Inventário LAR

Aplicação de inventário para o laboratório, com cadastro e aprovação de usuários, diretório da comunidade, projetos com filiação aprovada e documentos externos, empréstimos de equipamentos, reservas da impressora 3D e configurações pessoais.

## Tecnologias

- React + TypeScript + Vite
- Firebase Authentication para login por e-mail e tokens de sessão
- Cloud Firestore com autorização definida em regras de segurança

## Desenvolvimento

1. Configure o projeto Firebase seguindo [FIREBASE_SETUP.md](./FIREBASE_SETUP.md).
2. Crie `.env.local` com base em [.env.example](./.env.example).
3. Execute:

```sh
npm install
npm run dev
```

Antes de publicar alterações, execute `npm run lint` e `npm run build`.

O workflow do GitHub Pages requer as seis variáveis `VITE_FIREBASE_*` configuradas em **Settings → Secrets and variables → Actions**. O plano Firebase Spark possui limites sujeitos a alterações; consulte o guia para detalhes sobre cotas, implantação e criação do primeiro administrador.
