import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { reservationId } = await request.json()
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: reservation, error } = await admin.from('printer_reservations').select('*').eq('id', reservationId).single()
    if (error || !reservation) throw new Error(error?.message || 'Reserva não encontrada')
    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) throw new Error('RESEND_API_KEY não configurada')
    const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({
      from: Deno.env.get('EMAIL_FROM') || 'InventárioLAR <onboarding@resend.dev>', to: [reservation.teacher_email], subject: `Solicitação de uso da impressora 3D — ${reservation.student_name}`,
      html: `<h2>Nova solicitação no InventárioLAR</h2><p>O aluno <strong>${reservation.student_name}</strong> solicitou o uso da impressora 3D.</p><p><strong>Data:</strong> ${reservation.reservation_date}<br><strong>Horário:</strong> ${reservation.start_time} às ${reservation.end_time}<br><strong>Finalidade:</strong> ${reservation.purpose}</p><p>Acesse o InventárioLAR para aprovar ou recusar a solicitação.</p>`,
    }) })
    if (!response.ok) throw new Error(await response.text())
    return new Response(JSON.stringify({ sent: true }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (error) { return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro ao enviar e-mail' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }) }
})
