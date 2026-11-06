import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore'
import { FileText, Search, Users } from 'lucide-react'
import { db } from '../lib/firebase'
import type { ProjectMember, PublicProfile } from '../types'
import { Empty } from '../components/ui'
import { exportUsersPdf, type UserReportField } from '../utils/reports'

type DirectoryEntry = PublicProfile & { projects: string[] }

const roleName = (role: PublicProfile['account_role']) => role === 'administrador'
  ? 'Administrador'
  : role === 'professor' ? 'Professor' : 'Aluno'

export function UsersPage() {
  const [users, setUsers] = useState<DirectoryEntry[]>([])
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'todos' | PublicProfile['account_role']>('todos')
  const [reportFields, setReportFields] = useState<UserReportField[]>(['full_name', 'matricula', 'projects'])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const loadDirectory = async () => {
      const firestore = db
      if (!firestore) return
      setLoading(true)
      try {
        const [profilesSnapshot, projectsSnapshot] = await Promise.all([
          getDocs(query(collection(firestore, 'public_profiles'), where('status', '==', 'approved'), orderBy('full_name'))),
          getDocs(collection(firestore, 'projects')),
        ])
        const projectNames = new Map(projectsSnapshot.docs.map((item) => [item.id, String(item.data().name)]))
        const projectsByUser = new Map<string, string[]>()
        const membershipSnapshots = await Promise.all(projectsSnapshot.docs.map((project) =>
          getDocs(query(
            collection(firestore, 'projects', project.id, 'members'),
            where('status', '==', 'approved'),
          )),
        ))
        membershipSnapshots.forEach((snapshot, index) => {
          const project = projectsSnapshot.docs[index]
          const projectName = projectNames.get(project.id)
          if (!projectName) return
          const projectLeaderId = project.data().leader_id
          if (typeof projectLeaderId === 'string') {
            projectsByUser.set(projectLeaderId, [...(projectsByUser.get(projectLeaderId) ?? []), `${projectName} (líder)`])
          }
          snapshot.docs.forEach((item) => {
            const member = item.data() as ProjectMember
            projectsByUser.set(member.uid, [...(projectsByUser.get(member.uid) ?? []), projectName])
          })
        })
        if (active) {
          setUsers(profilesSnapshot.docs.map((item) => ({
            ...item.data(),
            id: item.id,
            projects: projectsByUser.get(item.id) ?? [],
          }) as DirectoryEntry))
          setError('')
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar a lista de usuários.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadDirectory()
    return () => { active = false }
  }, [])

  const filteredUsers = useMemo(() => users.filter((user) => {
    const matchesRole = roleFilter === 'todos' || user.account_role === roleFilter
    const terms = `${user.full_name} ${user.matricula} ${user.email ?? ''} ${user.projects.join(' ')}`.toLocaleLowerCase()
    return matchesRole && terms.includes(search.trim().toLocaleLowerCase())
  }), [roleFilter, search, users])
  const toggleReportField = (field: UserReportField) => {
    setReportFields((current) => current.includes(field)
      ? current.filter((value) => value !== field)
      : [...current, field])
  }
  const generatePdf = () => {
    if (!reportFields.length) {
      setError('Selecione pelo menos um campo para o PDF.')
      return
    }
    if (!exportUsersPdf(filteredUsers, reportFields)) setError('O navegador bloqueou a janela do PDF. Permita pop-ups para este site e tente novamente.')
  }

  return <section className="directory-page">
    <div className="directory-intro"><span className="directory-icon"><Users size={20} /></span><div><h2>Comunidade do laboratório</h2><p>Consulte os nomes, matrículas e projetos dos usuários aprovados.</p></div><strong>{users.length} usuários</strong></div>
    <section className="directory-export settings-card">
      <div><h3>Exportar lista em PDF</h3><p>Escolha as colunas. O PDF incluirá os resultados dos filtros atuais.</p></div>
      <div className="directory-export-fields">
        {([
          ['full_name', 'Nome completo'],
          ['email', 'E-mail'],
          ['matricula', 'Matrícula'],
          ['projects', 'Projetos filiados'],
        ] as const).map(([field, label]) => <label key={field}><input type="checkbox" checked={reportFields.includes(field)} onChange={() => toggleReportField(field)} />{label}</label>)}
      </div>
      <button className="primary-button" disabled={!reportFields.length || loading} onClick={generatePdf}><FileText size={16} /> Gerar PDF</button>
    </section>
    <div className="toolbar directory-toolbar">
      <label className="search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, matrícula ou projeto..." /></label>
      <select aria-label="Filtrar por perfil" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as typeof roleFilter)}>
        <option value="todos">Todos os perfis</option><option value="professor">Professores</option><option value="aluno">Alunos</option><option value="administrador">Administradores</option>
      </select>
    </div>
    {error && <div className="error-note">{error}</div>}
    {loading ? <div className="empty-state">Carregando usuários...</div> : <div className="table-card directory-table">
      <div className="directory-head"><span>NOME COMPLETO</span><span>MATRÍCULA</span><span>PERFIL</span><span>PROJETOS FILIADOS</span></div>
      {filteredUsers.length ? filteredUsers.map((user) => <div className="directory-row" key={user.id}>
        <strong>{user.full_name}</strong><span>{user.matricula}</span><span><span className={`directory-role ${user.account_role}`}>{roleName(user.account_role)}</span></span>
        <span className="directory-projects">{user.projects.length ? user.projects.map((project) => <span className="project-chip" key={project}>{project}</span>) : <span className="muted">Sem projeto</span>}</span>
      </div>) : <Empty text="Nenhum usuário encontrado." />}
    </div>}
  </section>
}
