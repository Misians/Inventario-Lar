# Configuração do InventárioLAR

## Banco de dados

1. Abra o SQL Editor do projeto no Supabase.
2. Execute o conteúdo de `supabase-schema.sql`.
3. Mantenha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no `.env` local e nas variáveis do build do GitHub Pages.

## E-mails de aprovação

O navegador não deve guardar uma chave de e-mail. A função `supabase/functions/send-reservation-email/index.ts` envia as solicitações usando Resend.

1. Crie uma conta no Resend e gere uma API key.
2. Instale a CLI do Supabase e faça login.
3. Publique a função:

```bash
supabase functions deploy send-reservation-email
supabase secrets set RESEND_API_KEY=re_xxx EMAIL_FROM="InventárioLAR <noreply@seu-dominio.com>"
```

4. Configure e valide o domínio remetente no Resend. Enquanto isso, o sistema continua gravando a reserva e avisa que o e-mail ainda não foi configurado.

Para produção, substitua as políticas públicas do SQL por políticas baseadas em usuários autenticados. As políticas atuais facilitam o primeiro teste compartilhado, mas permitem que qualquer pessoa com acesso ao site altere os dados.
