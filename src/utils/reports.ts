import type { Equipment, Loan, Reservation, PublicProfile } from '../types'
export function exportCsv(equipment: Equipment[], loans: Loan[], reservations: Reservation[]) { const rows = [['tipo', 'item', 'responsável', 'quantidade', 'data'], ...loans.map((loan) => ['Equipamento', equipment.find((item) => item.id === loan.equipment_id)?.name || 'Removido', loan.person_name, String(loan.quantity), loan.taken_at]), ...reservations.filter((item) => item.status === 'approved').map((item) => ['Impressora 3D', item.purpose, item.student_name, '1', item.reservation_date])]; const blob = new Blob([rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' }), link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'relatorio-laboratorio.csv'; link.click() }
export function exportPdf(equipment: Equipment[], loans: Loan[], reservations: Reservation[]) { const popup = window.open('', '_blank'); if (!popup) return; const rows = [...loans.map((loan) => `<tr><td>Equipamento</td><td>${equipment.find((item) => item.id === loan.equipment_id)?.name || 'Removido'}</td><td>${loan.person_name}</td><td>${loan.quantity}</td><td>${loan.taken_at}</td></tr>`), ...reservations.filter((item) => item.status === 'approved').map((item) => `<tr><td>Impressora 3D</td><td>${item.purpose}</td><td>${item.student_name}</td><td>1</td><td>${item.reservation_date}</td></tr>`)]; popup.document.write(`<html><head><title>Relatório Inventário LAR</title><style>body{font-family:Arial;padding:28px;color:#172026}h1{color:#157a53}table{width:100%;border-collapse:collapse}td,th{padding:8px;border:1px solid #ccd9d0;text-align:left}th{background:#eaf6f0}</style></head><body><h1>Inventário LAR</h1><p>Relatório gerado em ${new Date().toLocaleString('pt-BR')}</p><table><thead><tr><th>Tipo</th><th>Item</th><th>Responsável</th><th>Qtd.</th><th>Data</th></tr></thead><tbody>${rows.join('') || '<tr><td colspan="5">Sem registros.</td></tr>'}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`); popup.document.close() }

export type UserReportField = 'email' | 'full_name' | 'matricula' | 'projects'

const escapeHtml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;')

export function exportUsersPdf(users: (PublicProfile & { projects: string[] })[], fields: UserReportField[]) {
  if (!fields.length) return false
  const popup = window.open('', '_blank')
  if (!popup) return false
  const labels: Record<UserReportField, string> = {
    email: 'E-mail',
    full_name: 'Nome completo',
    matricula: 'Matrícula',
    projects: 'Projetos filiados',
  }
  const rows = users.map((user) => {
    const values: Record<UserReportField, string> = {
      email: user.email || '—',
      full_name: user.full_name,
      matricula: user.matricula,
      projects: user.projects.join(', ') || '—',
    }
    return `<tr>${fields.map((field) => `<td>${escapeHtml(values[field])}</td>`).join('')}</tr>`
  })
  popup.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Lista de usuários - Inventário LAR</title><style>
    @page{size:landscape;margin:16mm}body{font-family:Arial,sans-serif;padding:18px;color:#172026}h1{color:#1769aa;font-size:22px;margin:0 0 6px}p{color:#64736b;font-size:12px;margin:0 0 18px}table{width:100%;border-collapse:collapse;table-layout:fixed}td,th{padding:9px 10px;border:1px solid #ccd9e2;text-align:left;overflow-wrap:anywhere;font-size:11px}th{background:#eaf4fd;color:#174e77}tbody tr:nth-child(even){background:#f7fafc}.empty{text-align:center;color:#64736b}
    </style></head><body><h1>Usuários do laboratório</h1><p>Gerado em ${escapeHtml(new Date().toLocaleString('pt-BR'))} · ${users.length} usuários</p><table><thead><tr>${fields.map((field) => `<th>${labels[field]}</th>`).join('')}</tr></thead><tbody>${rows.join('') || `<tr><td class="empty" colspan="${fields.length}">Nenhum usuário encontrado.</td></tr>`}</tbody></table><script>window.addEventListener('load',()=>window.print())</script></body></html>`)
  popup.document.close()
  return true
}


