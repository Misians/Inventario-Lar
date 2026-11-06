import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { onAuthStateChanged, reload, sendEmailVerification, signOut } from 'firebase/auth'
import { collection, doc, getDoc, getDocs, orderBy, query, runTransaction, setDoc, updateDoc, where } from 'firebase/firestore'
import { AlertCircle, ArrowDownToLine, BarChart3, CalendarDays, Check, ClipboardList, Download, FileText, FolderKanban, Mail, Moon, Package, Plus, Printer, Search, Settings, Settings2, Sun, UserRoundCheck, Users, X } from 'lucide-react'
import logo from './assets/logo-nome.png'
import { auth, db, isFirebaseConfigured } from './lib/firebase'
import type { AccessProfile, Equipment, Loan, Reservation, Role, Tab, UiPreferences } from './types'
import { EquipmentTable } from './components/EquipmentTable'
import { AccessRequests, AccessStatus, Login, Modal, Nav, PasswordChangeForm, SectionHeading, Stat } from './components/ui'
import { HistoryPage } from './pages/HistoryPage'
import { PrinterPage } from './pages/PrinterPage'
import { ReportsPage } from './pages/ReportsPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { UsersPage } from './pages/UsersPage'
import { exportCsv, exportPdf } from './utils/reports'
import './App.css'
import './blue.css'
import './modern.css'
import './settings.css'

function App() {
  const [profile, setProfile] = useState<AccessProfile | null>(null)
  const [accessRequest, setAccessRequest] = useState<AccessProfile | null>(null)
  const [user, setUser] = useState<NonNullable<typeof auth>['currentUser']>(null)
  const [authReady, setAuthReady] = useState(() => !auth || !isFirebaseConfigured)
  const [authError, setAuthError] = useState('')

  const syncAccount = useCallback(async (currentUser: NonNullable<typeof auth>['currentUser']) => {
    const firestore = db
    if (!currentUser || !firestore) {
      setUser(null)
      setProfile(null)
      setAccessRequest(null)
      setAuthError('')
      setAuthReady(true)
      return
    }

    setUser(currentUser)
    setAuthReady(false)
    setAuthError('')
    let stage = 'atualizando a sessão do Firebase Authentication'
    try {
      await reload(currentUser)
      await currentUser.getIdToken(true)

      stage = `lendo profiles/${currentUser.uid}`
      const profileRef = doc(firestore, 'profiles', currentUser.uid)
      const profileSnapshot = await getDoc(profileRef)
      if (profileSnapshot.exists()) {
        const currentProfile = { ...profileSnapshot.data(), id: profileSnapshot.id } as AccessProfile
        setProfile(currentProfile)
        setAccessRequest(null)
        if (!currentUser.emailVerified) {
          return
        }
        const publicProfileRef = doc(firestore, 'public_profiles', currentUser.uid)
        try {
          stage = `sincronizando public_profiles/${currentUser.uid}`
          await runTransaction(firestore, async (transaction) => {
            const publicProfileSnapshot = await transaction.get(publicProfileRef)
            if (!publicProfileSnapshot.exists()) {
              transaction.set(publicProfileRef, {
                id: currentUser.uid,
                full_name: currentProfile.full_name,
                matricula: currentProfile.matricula,
                email: currentProfile.email,
                account_role: currentProfile.account_role,
                status: 'approved',
              })
            } else if (publicProfileSnapshot.data().email !== currentProfile.email) {
              transaction.update(publicProfileRef, { email: currentProfile.email })
            }
          })
        } catch (directoryError) {
          setAuthError(directoryError instanceof Error
            ? `Sua conta foi reconhecida, mas não foi possível sincronizar o perfil do diretório: ${directoryError.message}`
            : 'Sua conta foi reconhecida, mas não foi possível sincronizar o perfil do diretório.')
        }
        return
      }

      stage = `lendo access_requests/${currentUser.uid}`
      const requestRef = doc(firestore, 'access_requests', currentUser.uid)
      const requestSnapshot = await getDoc(requestRef)
      if (!requestSnapshot.exists()) {
        setProfile(null)
        setAccessRequest(null)
        return
      }
      const request = { ...requestSnapshot.data(), id: requestSnapshot.id } as AccessProfile
      setAccessRequest(request)

      if (request.status === 'approved' && currentUser.emailVerified) {
        const matriculaRef = doc(firestore, 'matriculas', request.matricula)
        const newProfile: AccessProfile = {
          id: currentUser.uid,
          matricula: request.matricula,
          full_name: request.full_name,
          email: request.email,
          account_role: request.account_role,
          status: 'approved',
          created_at: request.created_at,
        }
        stage = `criando profiles/${currentUser.uid} a partir da solicitação aprovada e da matrícula`
        await runTransaction(firestore, async (transaction) => {
          const [currentRequest, matriculaSnapshot] = await Promise.all([
            transaction.get(requestRef),
            transaction.get(matriculaRef),
          ])
          if (!currentRequest.exists() || currentRequest.data().status !== 'approved'
            || !matriculaSnapshot.exists() || matriculaSnapshot.data().uid !== currentUser.uid) {
            throw new Error('A solicitação aprovada ou a matrícula não corresponde à conta.')
          }
          transaction.set(profileRef, newProfile)
        })
        setProfile(newProfile)
        setAccessRequest(null)
        try {
          stage = `sincronizando public_profiles/${currentUser.uid}`
          await runTransaction(firestore, async (transaction) => {
            const publicProfileRef = doc(firestore, 'public_profiles', currentUser.uid)
            const publicProfileSnapshot = await transaction.get(publicProfileRef)
            if (!publicProfileSnapshot.exists()) {
              transaction.set(publicProfileRef, {
                id: currentUser.uid,
                full_name: newProfile.full_name,
                matricula: newProfile.matricula,
                email: newProfile.email,
                account_role: newProfile.account_role,
                status: 'approved',
              })
            }
          })
        } catch (directoryError) {
          setAuthError(directoryError instanceof Error
            ? `Sua conta foi aprovada, mas não foi possível sincronizar o perfil do diretório: ${directoryError.message}`
            : 'Sua conta foi aprovada, mas não foi possível sincronizar o perfil do diretório.')
        }
      } else {
        setProfile(null)
      }
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error
        ? ` (${String(error.code)})`
        : ''
      const detail = error instanceof Error ? error.message : 'Erro inesperado.'
      setAuthError(`Etapa: ${stage}. Projeto Firebase: ${firestore.app.options.projectId}. UID: ${currentUser.uid}.${code} ${detail}`)
      setProfile(null)
      setAccessRequest(null)
    } finally {
      setAuthReady(true)
    }
  }, [])

  useEffect(() => {
    if (!auth || !isFirebaseConfigured) return
    return onAuthStateChanged(auth, (currentUser) => { void syncAccount(currentUser) })
  }, [syncAccount])

  const handleSignOut = async () => {
    if (!auth) return
    try {
      await signOut(auth)
      setProfile(null)
      setAccessRequest(null)
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Não foi possível sair da conta.')
    }
  }

  const resendVerification = async () => {
    if (!user) return
    try {
      await sendEmailVerification(user)
      setAuthError('E-mail de confirmação enviado novamente.')
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Não foi possível reenviar o e-mail.')
    }
  }

  if (!isFirebaseConfigured || !auth || !db) return <Login />
  if (!authReady) return <div className="login-page"><p>Verificando sessão...</p></div>
  if (authError && !user) return <div className="login-page"><div className="login-panel"><p className="login-error">{authError}</p><Login /></div></div>
  if (!user) return <Login />

  if (!user.emailVerified) return <AccessStatus status="unverified" message={authError} onSignOut={() => { void handleSignOut() }} onResend={() => { void resendVerification() }} onRefresh={() => { void syncAccount(user) }} />
  if (authError && !profile) return <AccessStatus status="error" message={authError} userUid={user.uid} onSignOut={() => { void handleSignOut() }} onRefresh={() => { void syncAccount(user) }} />
  if (!profile) {
    const status = accessRequest?.status === 'pending' ? 'pending' : accessRequest?.status === 'rejected' ? 'rejected' : 'missing'
    return <AccessStatus status={status} userUid={user.uid} onSignOut={() => { void handleSignOut() }} onResend={() => { void resendVerification() }} onRefresh={() => { void syncAccount(user) }} />
  }
  if (profile.status !== 'approved') return <AccessStatus status="pending" userUid={user.uid} onSignOut={() => { void handleSignOut() }} onResend={() => { void resendVerification() }} onRefresh={() => { void syncAccount(user) }} />
  return <InventoryDashboard profile={profile} onSignOut={() => { void handleSignOut() }} initialError={authError} />
}

function InventoryDashboard({ profile, onSignOut, initialError = '' }: { profile: AccessProfile; onSignOut: () => void; initialError?: string }) {
  const role: Role = profile.account_role
  const canManage = role === 'professor' || role === 'administrador'
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [loans, setLoans] = useState<Loan[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [teachers, setTeachers] = useState<AccessProfile[]>([])
  const [accessRequests, setAccessRequests] = useState<AccessProfile[]>([])
  const [tab, setTab] = useState<Tab>('overview')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<'equipment' | 'loan' | 'reservation' | null>(null)
  const [selected, setSelected] = useState<Equipment | null>(null)
  const [error, setError] = useState(initialError)
  const [notice, setNotice] = useState('')
  const [passwordChangeOpen, setPasswordChangeOpen] = useState(false)
  const [preferences, setPreferences] = useState<UiPreferences>(() => {
    try {
      const saved = localStorage.getItem(`lar-ui-preferences:${profile.id}`)
      if (saved) {
        const parsed: unknown = JSON.parse(saved)
        if (typeof parsed === 'object' && parsed !== null
          && 'theme' in parsed && (parsed.theme === 'light' || parsed.theme === 'dark')
          && 'accent' in parsed && (parsed.accent === 'blue' || parsed.accent === 'green' || parsed.accent === 'purple')
          && 'density' in parsed && (parsed.density === 'comfortable' || parsed.density === 'compact')) {
          return parsed as UiPreferences
        }
      }
    } catch (preferenceError) {
      console.error('Unable to load saved interface preferences.', preferenceError)
    }
    return { theme: 'light', accent: 'blue', density: 'comfortable' }
  })

  const loadData = useCallback(async () => {
    if (!db) return
    try {
      const loansQuery = role === 'aluno'
        ? query(collection(db, 'loans'), where('borrower_id', '==', profile.id), orderBy('taken_at', 'desc'))
        : query(collection(db, 'loans'), orderBy('taken_at', 'desc'))
      const reservationsQuery = role === 'aluno'
        ? query(collection(db, 'printer_reservations'), where('user_id', '==', profile.id), orderBy('reservation_date', 'asc'))
        : query(collection(db, 'printer_reservations'), orderBy('reservation_date', 'asc'))
      const [equipmentSnapshot, loansSnapshot, reservationsSnapshot, teachersSnapshot, requestsSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'equipment'), orderBy('created_at', 'desc'))),
        getDocs(loansQuery),
        getDocs(reservationsQuery),
        getDocs(query(collection(db, 'profiles'), where('account_role', '==', 'professor'), where('status', '==', 'approved'), orderBy('full_name'))),
        canManage
          ? getDocs(query(
            collection(db, 'access_requests'),
            where('account_role', '==', role === 'professor' ? 'aluno' : 'professor'),
            where('status', '==', 'pending'),
            orderBy('created_at'),
          ))
          : Promise.resolve(null),
      ])
      setEquipment(equipmentSnapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as Equipment))
      setLoans(loansSnapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as Loan))
      setReservations(reservationsSnapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as Reservation))
      setTeachers(teachersSnapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as AccessProfile))
      setAccessRequests(requestsSnapshot?.docs.map((item) => ({ ...item.data(), id: item.id }) as AccessProfile) || [])
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os dados.')
    }
  }, [canManage, profile.id, role])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadData() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadData])

  const filtered = useMemo(
    () => equipment.filter((item) => `${item.name} ${item.code} ${item.category}`.toLowerCase().includes(search.toLowerCase())),
    [equipment, search],
  )
  const available = equipment.reduce((sum, item) => sum + item.quantity_available, 0)
  const borrowed = equipment.reduce((sum, item) => sum + item.quantity_total - item.quantity_available, 0)
  const overdue = loans.filter((loan) => !loan.returned_at && new Date(loan.expected_return_at) < new Date()).length
  const formatDate = (value?: string | null) => value
    ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
    : '—'
  const closeModal = () => { setModal(null); setSelected(null) }
  const openLoan = (item: Equipment) => { setSelected(item); setModal('loan') }
  const activeLoan = (item: Equipment) => loans.some((loan) => loan.equipment_id === item.id && !loan.returned_at)
  const updatePreferences = (next: UiPreferences) => {
    try {
      localStorage.setItem(`lar-ui-preferences:${profile.id}`, JSON.stringify(next))
      setPreferences(next)
    } catch (preferenceError) {
      setError(preferenceError instanceof Error
        ? `Não foi possível salvar as preferências neste navegador: ${preferenceError.message}`
        : 'Não foi possível salvar as preferências neste navegador.')
    }
  }

  const addEquipment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!db || !canManage) return setError('Apenas professores e administradores podem cadastrar equipamentos.')
    const form = new FormData(event.currentTarget)
    const code = String(form.get('code')).trim()
    if (!/^[a-z0-9._-]{1,100}$/i.test(code)) return setError('O código deve conter apenas letras, números, ponto, hífen ou sublinhado.')
    const quantity = Number(form.get('quantity_total'))
    const ref = doc(db, 'equipment', code.toLowerCase())
    try {
      await runTransaction(db, async (transaction) => {
        if ((await transaction.get(ref)).exists()) throw new Error('Já existe um equipamento com esse código.')
        transaction.set(ref, {
          name: String(form.get('name')).trim(),
          code,
          category: String(form.get('category')).trim(),
          location: String(form.get('location')).trim(),
          status: 'available',
          quantity_total: quantity,
          quantity_available: quantity,
          created_at: new Date().toISOString(),
        })
      })
      await loadData()
      closeModal()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível cadastrar o equipamento.')
    }
  }

  const createLoan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!db || !selected) return
    const form = new FormData(event.currentTarget)
    const quantity = Number(form.get('quantity'))
    const expectedReturnAt = new Date(`${form.get('expected_return_at')}T23:59:00`).toISOString()
    const equipmentRef = doc(db, 'equipment', selected.id)
    const loanRef = doc(collection(db, 'loans'))
    try {
      await runTransaction(db, async (transaction) => {
        const currentEquipment = await transaction.get(equipmentRef)
        if (!currentEquipment.exists() || currentEquipment.data().quantity_available < quantity) {
          throw new Error('Quantidade maior que o estoque disponível.')
        }
        const remaining = currentEquipment.data().quantity_available - quantity
        transaction.update(equipmentRef, {
          quantity_available: remaining,
          status: remaining === 0 ? 'borrowed' : 'available',
          last_loan_id: loanRef.id,
          last_loan_action: 'borrow',
        })
        transaction.set(loanRef, {
          id: loanRef.id,
          equipment_id: selected.id,
          borrower_id: profile.id,
          person_name: profile.full_name,
          taken_at: new Date().toISOString(),
          expected_return_at: expectedReturnAt,
          returned_at: null,
          quantity,
        })
      })
      await loadData()
      closeModal()
    } catch (loanError) {
      setError(loanError instanceof Error ? loanError.message : 'Não foi possível registrar a retirada.')
    }
  }

  const returnEquipment = async (item: Equipment) => {
    if (!db) return
    const loan = loans.find((entry) => entry.equipment_id === item.id && !entry.returned_at)
    if (!loan) return setError('Não há retirada ativa para este equipamento.')
    const equipmentRef = doc(db, 'equipment', item.id)
    const loanRef = doc(db, 'loans', loan.id)
    try {
      await runTransaction(db, async (transaction) => {
        const [currentLoan, currentEquipment] = await Promise.all([transaction.get(loanRef), transaction.get(equipmentRef)])
        if (!currentLoan.exists() || !currentEquipment.exists() || currentLoan.data().returned_at) {
          throw new Error('A retirada já foi devolvida ou não existe.')
        }
        const restored = Math.min(currentEquipment.data().quantity_total, currentEquipment.data().quantity_available + currentLoan.data().quantity)
        transaction.update(equipmentRef, {
          quantity_available: restored,
          status: 'available',
          last_loan_id: loan.id,
          last_loan_action: 'return',
        })
        transaction.update(loanRef, { returned_at: new Date().toISOString() })
      })
      await loadData()
    } catch (returnError) {
      setError(returnError instanceof Error ? returnError.message : 'Não foi possível registrar a devolução.')
    }
  }

  const decideReservation = async (reservation: Reservation, status: 'approved' | 'rejected') => {
    if (!db || !canManage) return setError('Apenas professores e administradores podem decidir reservas.')
    try {
      await updateDoc(doc(db, 'printer_reservations', reservation.id), { status })
      await loadData()
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Não foi possível atualizar a reserva.')
    }
  }

  const createReservation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!db) return
    const form = new FormData(event.currentTarget)
    const teacher = teachers.find((item) => item.id === String(form.get('teacher_id')))
    if (!teacher) return setError('Selecione um professor aprovado.')
    const ref = doc(collection(db, 'printer_reservations'))
    try {
      await setDoc(ref, {
        id: ref.id,
        user_id: profile.id,
        student_name: profile.full_name,
        student_email: profile.email,
        teacher_id: teacher.id,
        teacher_name: teacher.full_name,
        teacher_email: teacher.email,
        reservation_date: String(form.get('reservation_date')),
        start_time: String(form.get('start_time')),
        end_time: String(form.get('end_time')),
        purpose: String(form.get('purpose')).trim(),
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      setNotice('Reserva registrada. O professor poderá analisá-la no app.')
      await loadData()
      closeModal()
    } catch (reservationError) {
      setError(reservationError instanceof Error ? reservationError.message : 'Não foi possível registrar a reserva.')
    }
  }

  const reviewAccessRequest = async (request: AccessProfile, approve: boolean) => {
    if (!db || !canManage) return
    const requestRef = doc(db, 'access_requests', request.id)
    const matriculaRef = doc(db, 'matriculas', request.matricula)
    try {
      await runTransaction(db, async (transaction) => {
        const currentRequest = await transaction.get(requestRef)
        if (!currentRequest.exists() || currentRequest.data().status !== 'pending') {
          throw new Error('A solicitação já foi analisada.')
        }
        if (approve) {
          const existingMatricula = await transaction.get(matriculaRef)
          if (existingMatricula.exists()) throw new Error('Essa matrícula já está vinculada a outra conta.')
          transaction.set(matriculaRef, { uid: request.id })
        }
        transaction.update(requestRef, {
          status: approve ? 'approved' : 'rejected',
          reviewed_by: profile.id,
          reviewed_at: new Date().toISOString(),
        })
      })
      setNotice(`${request.account_role === 'aluno' ? 'Aluno' : 'Professor'} ${approve ? 'aprovado' : 'recusado'}.`)
      await loadData()
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Não foi possível analisar a solicitação.')
    }
  }

  const titles: Record<Tab, string> = {
    overview: 'Visão geral',
    equipment: 'Equipamentos',
    history: 'Histórico de movimentações',
    printer: 'Impressora 3D',
    reports: 'Relatórios e gráficos',
    access: 'Solicitações de acesso',
    settings: 'Configurações',
    users: 'Usuários',
    projects: 'Projetos',
  }

  return (
    <div className="app-shell" data-theme={preferences.theme} data-accent={preferences.accent} data-density={preferences.density}>
      <aside className="sidebar">
        <div className="brand"><img src={logo} alt="Inventário LAR" /></div>
        <nav>
          <Nav active={tab === 'overview'} click={() => setTab('overview')} icon={<ClipboardList size={18} />}>Visão geral</Nav>
          <Nav active={tab === 'equipment'} click={() => setTab('equipment')} icon={<Package size={18} />}>Equipamentos</Nav>
          <Nav active={tab === 'history'} click={() => setTab('history')} icon={<ArrowDownToLine size={18} />}>Histórico</Nav>
          <Nav active={tab === 'printer'} click={() => setTab('printer')} icon={<Printer size={18} />}>Impressora 3D</Nav>
          <Nav active={tab === 'reports'} click={() => setTab('reports')} icon={<BarChart3 size={18} />}>Relatórios</Nav>
          <Nav active={tab === 'projects'} click={() => setTab('projects')} icon={<FolderKanban size={18} />}>Projetos</Nav>
          <Nav active={tab === 'users'} click={() => setTab('users')} icon={<Users size={18} />}>Usuários</Nav>
          {canManage && <Nav active={tab === 'access'} click={() => setTab('access')} icon={<UserRoundCheck size={18} />}>Aprovar acessos</Nav>}
          <Nav active={tab === 'settings'} click={() => setTab('settings')} icon={<Settings size={18} />}>Configurações</Nav>
        </nav>
        <div className="sidebar-bottom">
          <div className="status-dot"><span /> Firebase</div>
          <div className="user-card"><div className="avatar">LA</div><div><strong>{profile.full_name}</strong><small>{role === 'administrador' ? 'Administrador' : role === 'professor' ? 'Professor' : 'Aluno'}</small></div><Settings2 size={16} /></div>
        </div>
      </aside>
      <main className="main-content">
        <div className="session-bar">
          <span>{profile.email} · {role === 'administrador' ? 'Administrador' : role === 'professor' ? 'Professor' : 'Aluno'}</span>
          <button onClick={onSignOut}>Sair</button>
        </div>
        <header className="topbar">
          <div><p className="eyebrow">CONTROLE DE ATIVOS</p><h1>{titles[tab]}</h1></div>
          {tab === 'access' || tab === 'settings' || tab === 'users' || tab === 'projects' ? null : tab === 'reports'
            ? <div className="report-actions"><button className="secondary-button" onClick={() => exportCsv(equipment, loans, reservations)}><Download size={16} /> CSV</button><button className="primary-button" onClick={() => exportPdf(equipment, loans, reservations)}><FileText size={16} /> Gerar PDF</button></div>
            : tab === 'printer'
              ? <button className="primary-button" onClick={() => setModal('reservation')}><CalendarDays size={18} /> Reservar horário</button>
              : tab === 'overview' || (tab === 'equipment' && canManage)
                ? <button className="primary-button" onClick={() => setModal('equipment')}><Plus size={18} /> Novo equipamento</button>
                : null}
        </header>
        {error && <div className="error-note"><AlertCircle size={18} />{error}<button onClick={() => setError('')}><X size={16} /></button></div>}
        {notice && <div className="success-note"><Check size={18} />{notice}<button onClick={() => setNotice('')}><X size={16} /></button></div>}
        {tab === 'overview' && <>
          <section className="stats">
            <Stat icon={<Package size={19} />} label="Tipos cadastrados" value={equipment.length} />
            <Stat icon={<Check size={19} />} label="Unidades disponíveis" value={available} />
            <Stat icon={<ArrowDownToLine size={19} />} label="Unidades em uso" value={borrowed} />
            <Stat icon={<AlertCircle size={19} />} label="Devoluções atrasadas" value={overdue} />
          </section>
          <SectionHeading text="Equipamentos recentes" onClick={() => setTab('equipment')} />
          <EquipmentTable items={filtered.slice(0, 5)} canMove onReturn={returnEquipment} onLoan={openLoan} hasActiveLoan={activeLoan} />
        </>}
        {tab === 'equipment' && <>
          <div className="toolbar"><div className="search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, código ou categoria..." /></div></div>
          <EquipmentTable items={filtered} canMove onReturn={returnEquipment} onLoan={openLoan} hasActiveLoan={activeLoan} />
        </>}
        {tab === 'history' && <HistoryPage loans={loans} equipment={equipment} formatDate={formatDate} />}
        {tab === 'printer' && <PrinterPage reservations={reservations} role={role} formatDate={formatDate} onDecide={decideReservation} />}
        {tab === 'reports' && <ReportsPage equipment={equipment} loans={loans} reservations={reservations} formatDate={formatDate} />}
        {tab === 'access' && canManage && <AccessRequests requests={accessRequests} onReview={reviewAccessRequest} />}
        {tab === 'users' && <UsersPage />}
        {tab === 'projects' && <ProjectsPage profile={profile} canManage={canManage} />}
        {tab === 'settings' && <div className="settings-grid">
          <section className="settings-card">
            <div className="settings-heading"><span className="settings-icon"><Settings2 size={19} /></span><div><h2>Personalização da interface</h2><p>As preferências ficam salvas neste navegador e nesta conta.</p></div></div>
            <label className="settings-field">Tema
              <span className="settings-control">{preferences.theme === 'dark' ? <Moon size={17} /> : <Sun size={17} />}
                <select value={preferences.theme} onChange={(event) => updatePreferences({ ...preferences, theme: event.target.value as UiPreferences['theme'] })}>
                  <option value="light">Claro</option><option value="dark">Escuro</option>
                </select>
              </span>
            </label>
            <label className="settings-field">Cor de destaque
              <span className="settings-control"><span className={`accent-dot ${preferences.accent}`} />
                <select value={preferences.accent} onChange={(event) => updatePreferences({ ...preferences, accent: event.target.value as UiPreferences['accent'] })}>
                  <option value="blue">Azul</option><option value="green">Verde</option><option value="purple">Roxo</option>
                </select>
              </span>
            </label>
            <label className="settings-field">Espaçamento da interface
              <span className="settings-control">
                <select value={preferences.density} onChange={(event) => updatePreferences({ ...preferences, density: event.target.value as UiPreferences['density'] })}>
                  <option value="comfortable">Confortável</option><option value="compact">Compacto</option>
                </select>
              </span>
            </label>
          </section>
          <section className="settings-card">
            <div className="settings-heading"><span className="settings-icon"><Settings2 size={19} /></span><div><h2>Minha conta</h2><p>Seus dados de acesso e segurança.</p></div></div>
            <dl className="account-details"><div><dt>Nome</dt><dd>{profile.full_name}</dd></div><div><dt>E-mail</dt><dd>{profile.email}</dd></div><div><dt>Matrícula</dt><dd>{profile.matricula}</dd></div><div><dt>Perfil</dt><dd>{role === 'administrador' ? 'Administrador' : role === 'professor' ? 'Professor' : 'Aluno'}</dd></div></dl>
            <button className="secondary-button settings-password-toggle" onClick={() => setPasswordChangeOpen(!passwordChangeOpen)}>{passwordChangeOpen ? 'Cancelar alteração' : 'Alterar senha'}</button>
            {passwordChangeOpen && <PasswordChangeForm onClose={() => setPasswordChangeOpen(false)} />}
          </section>
        </div>}
      </main>
      {modal === 'equipment' && canManage && <Modal title="Cadastrar equipamento" onClose={closeModal}><form onSubmit={addEquipment}><label>Nome<input name="name" maxLength={150} required /></label><label>Código<input name="code" maxLength={100} required /></label><label>Categoria<input name="category" maxLength={100} required /></label><label>Quantidade<input name="quantity_total" type="number" min="1" defaultValue="1" required /></label><label>Localização<input name="location" maxLength={150} required /></label><button className="primary-button full">Cadastrar</button></form></Modal>}
      {modal === 'loan' && selected && <Modal title="Registrar retirada" onClose={closeModal}><form onSubmit={createLoan}><label>Quantidade<input name="quantity" type="number" min="1" max={selected.quantity_available} defaultValue="1" required /></label><label>Devolução<input name="expected_return_at" type="date" min={new Date().toISOString().slice(0, 10)} required /></label><button className="primary-button full">Confirmar retirada</button></form></Modal>}
      {modal === 'reservation' && <Modal title="Reservar a impressora 3D" onClose={closeModal}><form onSubmit={createReservation}><label>Professor aprovado<select name="teacher_id" required defaultValue=""><option value="" disabled>Selecione um professor</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.full_name} · {teacher.email}</option>)}</select></label><label>Data<input name="reservation_date" type="date" min={new Date().toISOString().slice(0, 10)} required /></label><label>Início<input name="start_time" type="time" required /></label><label>Fim<input name="end_time" type="time" required /></label><label>Finalidade<input name="purpose" maxLength={500} required /></label><button className="primary-button full"><Mail size={16} /> Registrar solicitação</button></form></Modal>}
    </div>
  )
}

export default App
