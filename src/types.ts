export type Equipment = { id: string; name: string; code: string; category: string; location: string; status: 'available' | 'borrowed'; quantity_total: number; quantity_available: number; created_at: string }
export type Loan = { id: string; equipment_id: string; person_name: string; taken_at: string; expected_return_at: string; returned_at: string | null; quantity: number }
export type Reservation = { id: string; student_name: string; student_email: string; teacher_name: string; teacher_email: string; reservation_date: string; start_time: string; end_time: string; purpose: string; status: 'pending' | 'approved' | 'rejected'; created_at: string }
export type Tab = 'overview' | 'equipment' | 'history' | 'printer' | 'reports'
export type Role = 'professor' | 'aluno'
