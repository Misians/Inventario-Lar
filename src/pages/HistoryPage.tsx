import { ArrowDownToLine } from 'lucide-react'
import type { Equipment, Loan } from '../types'
import { Empty } from '../components/ui'

export function HistoryPage({ loans, equipment, formatDate }: { loans: Loan[]; equipment: Equipment[]; formatDate: (value?: string | null) => string }) { return <div className="history-list">{loans.length ? loans.map((loan) => <div className="history-row" key={loan.id}><div className="history-icon"><ArrowDownToLine size={17} /></div><div><strong>{equipment.find((item) => item.id === loan.equipment_id)?.name || 'Equipamento removido'} · {loan.quantity} unidade(s)</strong><span>{loan.person_name} retirou em {formatDate(loan.taken_at)}</span></div><span className="pill">{loan.returned_at ? 'Devolvido' : 'Em uso'}</span></div>) : <Empty text="Nenhuma movimentação registrada ainda." />}</div> }
