import type { Equipment } from '../types'
export const demoEquipment: Equipment[] = [
  { id: '1', name: 'Motor de indução', code: 'MOT-001', category: 'Motores', location: 'Bancada A', status: 'available', quantity_total: 15, quantity_available: 15, created_at: '' },
  { id: '2', name: 'Balança de precisão', code: 'BAL-002', category: 'Medição', location: 'Bancada B', status: 'borrowed', quantity_total: 3, quantity_available: 1, created_at: '' },
  { id: '3', name: 'Centrífuga', code: 'CEN-003', category: 'Processamento', location: 'Sala 2', status: 'available', quantity_total: 2, quantity_available: 2, created_at: '' },
]
