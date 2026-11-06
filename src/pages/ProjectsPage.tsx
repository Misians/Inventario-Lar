import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { addDoc, collection, doc, getDoc, getDocs, orderBy, query, setDoc, updateDoc, where } from 'firebase/firestore'
import { ArrowLeft, ExternalLink, FileText, FolderKanban, Plus, Search, Users } from 'lucide-react'
import { db } from '../lib/firebase'
import type { AccessProfile, Project, ProjectDocument, ProjectMember } from '../types'
import { Empty } from '../components/ui'

export function ProjectsPage({ profile, canManage }: { profile: AccessProfile; canManage: boolean }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [membershipStatuses, setMembershipStatuses] = useState<Record<string, ProjectMember['status'] | null>>({})
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [documents, setDocuments] = useState<ProjectDocument[]>([])
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [pendingMembers, setPendingMembers] = useState<ProjectMember[]>([])
  const [showProjectForm, setShowProjectForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [showDocumentForm, setShowDocumentForm] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')

  const loadProjects = useCallback(async () => {
    const firestore = db
    if (!firestore) return
    try {
      const snapshot = await getDocs(query(collection(firestore, 'projects'), orderBy('name')))
      const loaded = snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as Project)
      const memberships = await Promise.all(loaded.map((project) => getDoc(doc(firestore, 'projects', project.id, 'members', profile.id))))
      const statuses: Record<string, ProjectMember['status'] | null> = {}
      memberships.forEach((membership, index) => {
        statuses[loaded[index].id] = membership.exists() ? membership.data().status as ProjectMember['status'] : null
      })
      setProjects(loaded)
      setMembershipStatuses(statuses)
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os projetos.')
    }
  }, [profile.id])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadProjects() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadProjects])

  const loadProjectDetails = useCallback(async (project: Project) => {
    if (!db) return
    setSelectedProject(project)
    setDocuments([])
    setMembers([])
    setPendingMembers([])
    setError('')
    try {
      const memberStatus = membershipStatuses[project.id]
      if (!canManage && memberStatus !== 'approved') return
      const [documentsSnapshot, membersSnapshot, pendingSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'projects', project.id, 'documents'), orderBy('created_at', 'desc'))),
        getDocs(query(collection(db, 'projects', project.id, 'members'), where('status', '==', 'approved'))),
        canManage
          ? getDocs(query(collection(db, 'projects', project.id, 'members'), where('status', '==', 'pending'), orderBy('requested_at')))
          : Promise.resolve(null),
      ])
      setDocuments(documentsSnapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as ProjectDocument))
      setMembers(membersSnapshot.docs.map((item) => item.data() as ProjectMember))
      setPendingMembers(pendingSnapshot?.docs.map((item) => item.data() as ProjectMember) ?? [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os detalhes do projeto.')
    }
  }, [canManage, membershipStatuses])

  const visibleProjects = useMemo(() => projects.filter((project) =>
    `${project.name} ${project.description}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())), [projects, search])

  const createProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!db || !canManage) return
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name')).trim()
    const description = String(form.get('description')).trim()
    try {
      const reference = await addDoc(collection(db, 'projects'), {
        name, description, created_by: profile.id,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      })
      setNotice('Projeto criado.')
      setShowProjectForm(false)
      await loadProjects()
      const project = { id: reference.id, name, description, created_by: profile.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      setSelectedProject(project)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível criar o projeto.')
    }
  }

  const updateProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!db || !selectedProject || !canManage) return
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name')).trim()
    const description = String(form.get('description')).trim()
    try {
      await updateDoc(doc(db, 'projects', selectedProject.id), {
        name, description, updated_at: new Date().toISOString(),
      })
      const updatedProject = { ...selectedProject, name, description, updated_at: new Date().toISOString() }
      setSelectedProject(updatedProject)
      setShowEditForm(false)
      setNotice('Projeto atualizado.')
      await loadProjects()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível atualizar o projeto.')
    }
  }

  const requestMembership = async (project: Project) => {
    if (!db || profile.account_role !== 'aluno') return
    const memberRef = doc(db, 'projects', project.id, 'members', profile.id)
    const previousStatus = membershipStatuses[project.id]
    try {
      const membership: ProjectMember = {
        uid: profile.id,
        full_name: profile.full_name,
        matricula: profile.matricula,
        status: 'pending',
        requested_at: new Date().toISOString(),
      }
      if (previousStatus === 'rejected') await updateDoc(memberRef, { status: 'pending', requested_at: membership.requested_at })
      else await setDoc(memberRef, membership)
      setNotice('Solicitação de filiação enviada para aprovação.')
      await loadProjects()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível solicitar a filiação.')
    }
  }

  const reviewMembership = async (member: ProjectMember, status: 'approved' | 'rejected') => {
    if (!db || !selectedProject || !canManage) return
    try {
      await updateDoc(doc(db, 'projects', selectedProject.id, 'members', member.uid), {
        status, reviewed_by: profile.id, reviewed_at: new Date().toISOString(),
      })
      setNotice(`Filiação ${status === 'approved' ? 'aprovada' : 'recusada'}.`)
      await loadProjectDetails(selectedProject)
      await loadProjects()
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Não foi possível analisar a solicitação.')
    }
  }

  const addDocument = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!db || !selectedProject || !canManage) return
    const form = new FormData(event.currentTarget)
    const url = String(form.get('url')).trim()
    if (!URL.canParse(url) || new URL(url).protocol !== 'https:') {
      setError('Informe um link HTTPS válido para o documento.')
      return
    }
    try {
      await addDoc(collection(db, 'projects', selectedProject.id, 'documents'), {
        title: String(form.get('title')).trim(),
        url,
        description: String(form.get('description')).trim(),
        added_by: profile.id,
        created_at: new Date().toISOString(),
      })
      setShowDocumentForm(false)
      setNotice('Documento adicionado ao projeto.')
      await loadProjectDetails(selectedProject)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível adicionar o documento.')
    }
  }

  return <section className="projects-page">
    {error && <div className="error-note">{error}</div>}
    {notice && <div className="success-note">{notice}</div>}
    {selectedProject ? <>
      <button className="text-button project-back" onClick={() => { setSelectedProject(null); setShowDocumentForm(false); setShowEditForm(false) }}><ArrowLeft size={16} /> Voltar aos projetos</button>
      <div className="project-detail-header"><div><p className="eyebrow">PROJETO DO LABORATÓRIO</p><h2>{selectedProject.name}</h2><p>{selectedProject.description}</p></div>
        {canManage && <div className="project-header-actions"><button className="secondary-button" onClick={() => setShowEditForm(!showEditForm)}>Editar projeto</button><button className="primary-button" onClick={() => setShowDocumentForm(!showDocumentForm)}><Plus size={16} /> Adicionar documento</button></div>}
      </div>
      {showEditForm && <form className="project-form project-inline-form" onSubmit={(event) => { void updateProject(event) }}>
        <label>Nome do projeto<input name="name" defaultValue={selectedProject.name} maxLength={150} required /></label>
        <label className="project-description-field">Descrição dos trabalhos<textarea name="description" defaultValue={selectedProject.description} maxLength={2000} rows={4} required /></label>
        <button className="primary-button" type="submit">Salvar alterações</button>
      </form>}
      {showDocumentForm && <form className="project-form project-inline-form" onSubmit={(event) => { void addDocument(event) }}>
        <label>Título do documento<input name="title" maxLength={150} required /></label><label>Link HTTPS<input name="url" type="url" placeholder="https://..." required /></label>
        <label className="project-description-field">Descrição do trabalho / documento<textarea name="description" maxLength={1000} rows={3} required /></label>
        <button className="primary-button" type="submit">Salvar documento</button>
      </form>}
      {profile.account_role === 'aluno' && membershipStatuses[selectedProject.id] !== 'approved' && <div className="membership-callout">
        <p>{membershipStatuses[selectedProject.id] === 'pending' ? 'Sua solicitação de filiação está aguardando aprovação.' : membershipStatuses[selectedProject.id] === 'rejected' ? 'Sua solicitação anterior não foi aprovada. Você pode solicitar novamente.' : 'Filie-se a este projeto para consultar os documentos e a descrição dos trabalhos.'}</p>
        {membershipStatuses[selectedProject.id] !== 'pending' && <button className="primary-button" onClick={() => { void requestMembership(selectedProject) }}>{membershipStatuses[selectedProject.id] === 'rejected' ? 'Solicitar novamente' : 'Solicitar filiação'}</button>}
      </div>}
      <div className="project-columns">
        <section className="settings-card project-section"><div className="settings-heading"><span className="settings-icon"><FileText size={19} /></span><div><h2>Documentos e trabalhos</h2><p>Materiais disponíveis aos membros aprovados.</p></div></div>
          {membershipStatuses[selectedProject.id] === 'approved' || canManage
            ? documents.length ? documents.map((item) => <article className="project-document" key={item.id}><div><strong>{item.title}</strong><p>{item.description}</p></div><a href={item.url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${item.title}`}><ExternalLink size={17} /></a></article>)
              : <Empty text="Ainda não há documentos neste projeto." />
            : <p className="muted project-private-note">Os documentos serão exibidos após a aprovação da sua filiação.</p>}
        </section>
        <section className="settings-card project-section"><div className="settings-heading"><span className="settings-icon"><Users size={19} /></span><div><h2>Membros do projeto</h2><p>{members.length} filiações aprovadas</p></div></div>
          {pendingMembers.length > 0 && <div className="project-requests"><h3>Solicitações pendentes</h3>{pendingMembers.map((member) => <div className="project-member" key={member.uid}><div><strong>{member.full_name}</strong><small>Matrícula {member.matricula}</small></div><button className="approve-button" onClick={() => { void reviewMembership(member, 'approved') }}>Aprovar</button><button className="reject-button" onClick={() => { void reviewMembership(member, 'rejected') }}>Recusar</button></div>)}</div>}
          {members.length ? members.map((member) => <div className="project-member" key={member.uid}><div><strong>{member.full_name}</strong><small>Matrícula {member.matricula}</small></div><span className="directory-role aluno">Aluno</span></div>) : <Empty text="Nenhum membro aprovado ainda." />}
        </section>
      </div>
    </> : <>
      <div className="directory-intro"><span className="directory-icon"><FolderKanban size={20} /></span><div><h2>Projetos do laboratório</h2><p>Explore projetos, solicite filiação e acompanhe os trabalhos.</p></div>{canManage && <button className="primary-button" onClick={() => setShowProjectForm(!showProjectForm)}><Plus size={16} /> Novo projeto</button>}</div>
      {showProjectForm && <form className="project-form" onSubmit={(event) => { void createProject(event) }}><label>Nome do projeto<input name="name" maxLength={150} required /></label><label>Descrição dos trabalhos<textarea name="description" maxLength={2000} rows={4} required /></label><button className="primary-button" type="submit">Criar projeto</button></form>}
      <label className="search projects-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar projetos..." /></label>
      <div className="project-cards">{visibleProjects.length ? visibleProjects.map((project) => {
        const status = membershipStatuses[project.id]
        return <article className="project-card" key={project.id}>
          <div className="project-card-top"><span className="settings-icon"><FolderKanban size={19} /></span><span className={`project-status ${status ?? 'none'}`}>{status === 'approved' ? 'Filiado' : status === 'pending' ? 'Aguardando aprovação' : status === 'rejected' ? 'Solicitação recusada' : 'Aberto'}</span></div>
          <h3>{project.name}</h3><p>{project.description}</p>
          <div className="project-card-actions">
            <button className="text-button" onClick={() => { void loadProjectDetails(project) }}>Ver projeto →</button>
            {profile.account_role === 'aluno' && status !== 'approved' && <button className="action-button" disabled={status === 'pending'} onClick={() => { void requestMembership(project) }}>{status === 'pending' ? 'Aguardando aprovação' : status === 'rejected' ? 'Solicitar novamente' : 'Solicitar filiação'}</button>}
          </div>
        </article>
      }) : <Empty text="Nenhum projeto cadastrado." />}</div>
    </>}
  </section>
}
