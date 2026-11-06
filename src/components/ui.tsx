import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { BarChart3, Check, Package, X } from 'lucide-react'
import { createUserWithEmailAndPassword, deleteUser, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, updatePassword } from 'firebase/auth'
import { collection, doc, runTransaction } from 'firebase/firestore'
import logo from '../assets/logo-nome.png'
import { auth, db, isFirebaseConfigured } from '../lib/firebase'
import type { AccessProfile } from '../types'

export function Login() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [matricula, setMatricula] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [requestedRole, setRequestedRole] = useState<'aluno' | 'professor'>('aluno')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const setRoleFromSelect = (value: string) => {
    if (value === 'aluno' || value === 'professor') setRequestedRole(value)
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage('')
    if (!auth || !db || !isFirebaseConfigured) {
      setMessage('Configure o Firebase. Veja FIREBASE_SETUP.md.')
      return
    }
    if (password.length < 12 || password.length > 72) {
      setMessage('A senha deve ter entre 12 e 72 caracteres.')
      return
    }

    setSubmitting(true)
    if (mode === 'signup') {
      const cleanMatricula = matricula.trim().toLowerCase()
      if (!/^[a-z0-9._-]{1,100}$/.test(cleanMatricula)) {
        setSubmitting(false)
        setMessage('A matrícula deve conter apenas letras, números, ponto, hífen ou sublinhado.')
        return
      }

      let user: Awaited<ReturnType<typeof createUserWithEmailAndPassword>>['user'] | null = null
      try {
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password)
        const newUser = credential.user
        if (!newUser.email) throw new Error('A conta Firebase não contém um endereço de e-mail.')
        user = newUser
        await sendEmailVerification(newUser)
        const requestRef = doc(collection(db, 'access_requests'), newUser.uid)
        await runTransaction(db, async (transaction) => {
          transaction.set(requestRef, {
            id: newUser.uid,
            matricula: cleanMatricula,
            full_name: fullName.trim(),
            email: newUser.email,
            account_role: requestedRole,
            status: 'pending',
            created_at: new Date().toISOString(),
          })
        })
        setMessage('Solicitação criada. Confirme seu e-mail e aguarde a aprovação do acesso.')
      } catch (signupError) {
        if (user && auth.currentUser?.uid === user.uid && !user.emailVerified) {
          try {
            await deleteUser(user)
          } catch (cleanupError) {
            console.error('Unable to clean up incomplete Firebase signup.', cleanupError)
          }
        }
        setMessage(signupError instanceof Error ? `Não foi possível solicitar acesso: ${signupError.message}` : 'Não foi possível solicitar acesso.')
      } finally {
        setSubmitting(false)
      }
      return
    }

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password)
    } catch {
      setMessage('E-mail ou senha inválidos.')
    } finally {
      setSubmitting(false)
    }
  }

  const resetPassword = async () => {
    setMessage('')
    if (!auth) {
      setMessage('Configure o Firebase antes de solicitar a redefinição de senha.')
      return
    }
    if (!email.trim()) {
      setMessage('Informe seu e-mail no campo acima para receber o link de redefinição.')
      return
    }
    try {
      await sendPasswordResetEmail(auth, email.trim())
      setMessage('Se esse e-mail estiver cadastrado, você receberá as instruções para redefinir a senha.')
    } catch (resetError) {
      setMessage(resetError instanceof Error ? `Não foi possível enviar o link: ${resetError.message}` : 'Não foi possível enviar o link de redefinição.')
    }
  }

  return <div className="login-page"><div className="login-panel"><div className="login-brand"><img src={logo} alt="Inventário LAR" /></div><div className="login-copy"><span>CONTROLE DE ATIVOS</span><h1>{mode === 'signup' ? 'Solicite seu acesso ao laboratório.' : 'Laboratório organizado, decisões mais simples.'}</h1><p>{mode === 'signup' ? 'Seu cadastro será analisado antes da liberação do acesso.' : 'Acesse a plataforma para acompanhar equipamentos, retiradas e o uso da impressora 3D.'}</p></div><form className="login-form" onSubmit={submit}>{mode === 'signup' && <><label>Nome completo<input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" maxLength={150} required /></label><label>Matrícula<input value={matricula} onChange={(event) => setMatricula(event.target.value)} autoComplete="username" maxLength={100} required /></label><label>Tipo de acesso<select value={requestedRole} onChange={(event) => setRoleFromSelect(event.target.value)}><option value="aluno">Aluno</option><option value="professor">Professor</option></select></label></>}<label>E-mail<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required /></label><label>Senha<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder={mode === 'signup' ? 'Mínimo de 12 caracteres' : 'Digite sua senha'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={12} maxLength={72} required /></label>{message && <div className="login-error">{message}</div>}<button className="primary-button login-button" disabled={submitting}>{submitting ? 'Aguarde...' : mode === 'signup' ? 'Solicitar acesso' : 'Entrar na plataforma'}</button></form>{mode === 'login' && <button className="text-button login-toggle" onClick={() => { void resetPassword() }}>Esqueci minha senha</button>}<button className="text-button login-toggle" onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setMessage('') }}>{mode === 'signup' ? 'Já tem acesso? Entrar' : 'Primeiro acesso? Solicitar cadastro'}</button><small className="login-hint">Alunos: aprovação por professor. Professores: aprovação pelo administrador. Login com e-mail.</small></div></div>
}

export function PasswordChangeForm({ onClose }: { onClose: () => void }) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage('')
    if (!auth?.currentUser) {
      setMessage('Entre novamente para alterar sua senha.')
      return
    }
    if (newPassword.length < 12 || newPassword.length > 72) {
      setMessage('A nova senha deve ter entre 12 e 72 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      setMessage('As senhas não conferem.')
      return
    }

    setSubmitting(true)
    try {
      await updatePassword(auth.currentUser, newPassword)
      onClose()
    } catch (updateError) {
      setMessage(updateError instanceof Error ? `Não foi possível alterar a senha: ${updateError.message}` : 'Não foi possível alterar a senha.')
    } finally {
      setSubmitting(false)
    }
  }

  return <form className="settings-password-form" onSubmit={submit}><label>Nova senha<input value={newPassword} onChange={(event) => setNewPassword(event.target.value)} type="password" autoComplete="new-password" minLength={12} maxLength={72} required /></label><label>Confirme a nova senha<input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} type="password" autoComplete="new-password" minLength={12} maxLength={72} required /></label><small>Use entre 12 e 72 caracteres.</small>{message && <div className="login-error">{message}</div>}<button className="primary-button full" disabled={submitting}>{submitting ? 'Salvando...' : 'Salvar nova senha'}</button></form>
}

export function AccessRequests({ requests, onReview }: { requests: AccessProfile[]; onReview: (request: AccessProfile, approve: boolean) => void }) {
  return <div className="reservation-list">{requests.length ? requests.map((request) => <div className="reservation-card" key={request.id}><div className="reservation-info"><strong>{request.full_name}</strong><span>{request.account_role === 'professor' ? 'Professor' : 'Aluno'} · matrícula {request.matricula}</span><span>{request.email} · {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(request.created_at))}</span></div><span className="pill reservation-pending">Pendente</span><div className="reservation-actions"><button className="approve-button" onClick={() => onReview(request, true)}><Check size={15} /> Aprovar</button><button className="reject-button" onClick={() => onReview(request, false)}><X size={15} /> Recusar</button></div></div>) : <div className="empty-state"><Package size={28} /><p>Nenhuma solicitação pendente.</p></div>}</div>
}

export function AccessStatus({ status, message, userUid, onSignOut, onResend, onRefresh }: { status: 'unverified' | 'pending' | 'rejected' | 'missing' | 'error'; message?: string; userUid?: string; onSignOut: () => void; onResend?: () => void; onRefresh: () => void }) {
  const copy = {
    unverified: ['Confirme seu e-mail.', 'Use o link que enviamos para seu e-mail e depois atualize esta página.'],
    pending: ['Acesso aguardando aprovação.', 'Seu cadastro foi recebido. O professor ou administrador responsável precisa aprovar sua solicitação.'],
    rejected: ['Solicitação não aprovada.', 'Entre em contato com a administração do laboratório caso precise de ajuda.'],
    missing: ['Perfil não encontrado no Firestore.', 'Para uma conta criada manualmente, confira se existe profiles/{UID} e se status está definido como approved. O UID deve ser o mesmo da conta em Authentication.'],
    error: ['Não foi possível verificar seu cadastro.', 'O login foi aceito, mas a leitura do perfil no Firestore falhou. Confira se as regras foram publicadas no projeto Firebase correto e se o documento profiles/{UID} existe.'],
  }[status]
  return <div className="login-page"><div className="login-panel"><div className="login-brand"><img src={logo} alt="Inventário LAR" /></div><div className="login-copy"><span>CONTROLE DE ATIVOS</span><h1>{copy[0]}</h1><p>{copy[1]}</p></div>{message && <div className="login-error">{message}</div>}{userUid && (status === 'missing' || status === 'error') && <div className="login-diagnostic"><strong>UID da conta autenticada</strong><code>{userUid}</code><span>Compare este valor com o ID do documento em Firestore → profiles.</span></div>}{status === 'unverified' && <>{onResend && <button className="secondary-button login-toggle" onClick={onResend}>Reenviar confirmação</button>}<button className="text-button login-toggle" onClick={onRefresh}>Já confirmei meu e-mail · Atualizar</button></>}{(status === 'pending' || status === 'missing' || status === 'error') && <button className="secondary-button login-toggle" onClick={onRefresh}>Verificar novamente</button>}<button className="primary-button login-button" onClick={onSignOut}>Sair</button></div></div>
}

export function Nav({ active, click, icon, children }: { active: boolean; click: () => void; icon: ReactNode; children: ReactNode }) { return <button className={active ? 'active' : ''} onClick={click}>{icon}{children}</button> }
export function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: number }) { return <div className="stat-card"><span className="stat-icon green">{icon}</span><div><small>{label}</small><strong>{value}</strong></div></div> }
export function SectionHeading({ text, onClick }: { text: string; onClick: () => void }) { return <div className="section-heading"><div><h2>{text}</h2><p>Acompanhe o status e a quantidade dos itens do laboratório</p></div><button className="text-button" onClick={onClick}>Ver todos →</button></div> }
export function Empty({ text }: { text: string }) { return <div className="empty-state"><Package size={28} /><p>{text}</p></div> }
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) { return <div className="modal-backdrop"><div className="modal"><div className="modal-header"><div><p className="eyebrow">INVENTÁRIO LAR</p><h2>{title}</h2></div><button className="close-button" onClick={onClose}><X size={19} /></button></div>{children}</div></div> }
export function ReportStat({ label, value }: { label: string; value: number }) { return <div className="report-stat"><span><BarChart3 size={18} /></span><div><small>{label}</small><strong>{value}</strong></div></div> }
export function Pagination({ page, total, onChange }: { page: number; total: number; onChange: (page: number) => void }) { if (total < 2) return null; return <div className="pagination"><button disabled={page === 1} onClick={() => onChange(page - 1)}>Anterior</button><span>Página {page} de {total}</span><button disabled={page === total} onClick={() => onChange(page + 1)}>Próxima</button></div> }
