import './atlas.css'
import { useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, WheelEvent } from 'react'
import type { Employee, Project } from '../../types/domain'
import type { AtlasDocument } from '../../services/atlas'

type KnowledgeAtlasProps = {
  projects: Project[]
  documents: AtlasDocument[]
  people: Employee[]
  displayName: string
  onSignOut: () => void | Promise<void>
}
type Tone = 'indigo' | 'sage' | 'teal' | 'sand'

type KnowledgeNode = {
  id: string
  title: string
  kind: string
  department?: string
  x: number
  y: number
  tone: Tone
  summary: string
  source: string
  updated: string
  detail: string
  tags: string[]
}

type Cluster = {
  id: string
  title: string
  eyebrow: string
  x: number
  y: number
  width: number
  height: number
  tone: Tone
  nodes: KnowledgeNode[]
}

type RelationshipStatus = 'proposed' | 'confirmed' | 'rejected'
type EvidenceType = 'Direct evidence' | 'Inferred relevance'

type Relationship = {
  id: string
  sourceId: string
  targetId: string
  label: string
  status: RelationshipStatus
  reason: string
  sources: string[]
  evidenceType: EvidenceType
  confidence?: 'Low' | 'Medium' | 'High'
}

type FeedbackRecord = {
  relationshipId: string
  sourceId: string
  targetId: string
  userId: string
  action: 'accepted' | 'rejected'
  timestamp: string
  evidenceType: EvidenceType
  originalConfidence?: 'Low' | 'Medium' | 'High'
}

function buildClusters(
  projects: Project[],
  documents: AtlasDocument[],
  people: Employee[],
): Cluster[] {
  const positions = [
    { x: 175, y: 170, width: 490, tone: 'indigo' as Tone },
    { x: 935, y: 135, width: 500, tone: 'sage' as Tone },
    { x: 540, y: 625, width: 540, tone: 'teal' as Tone },
    { x: 110, y: 625, width: 390, tone: 'sand' as Tone },
  ]

  const seasons = projects.map((project, index) => {
    const position = positions[index] ?? positions[0]
    const production = project.name.includes(':')
      ? project.name.split(':').slice(1).join(':').trim()
      : project.name

    const matchingDocs = documents.filter((doc) =>
      doc.projectId === project.id ||
      (doc.production && doc.production.toLowerCase() === production.toLowerCase()),
    )

    const groups = new Map<string, AtlasDocument[]>()
    matchingDocs.forEach((doc) => {
      const department = doc.department || 'Uncategorized'
      const type = doc.documentType || doc.subcategory || 'Project document'
      const key = `${department}|||${type}`
      groups.set(key, [...(groups.get(key) ?? []), doc])
    })

    const nodes: KnowledgeNode[] = [...groups.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 6)
      .map(([key, records], nodeIndex) => {
        const [department, documentType] = key.split('|||')
        const first = records[0]
        const label = documentType.includes(':')
          ? documentType.split(':').slice(1).join(':').trim()
          : documentType

        return {
          id: `docs-${project.id}-${nodeIndex}`,
          title: label,
          kind: `${department} · ${records.length} records`,
          department,
          x: 28 + (nodeIndex % 2) * 215,
          y: 92 + Math.floor(nodeIndex / 2) * 88,
          tone: position.tone,
          summary: `${records.length} ${documentType.toLowerCase()} records for ${production}.`,
          source: 'Supabase document records',
          updated: `${records.length} matching records`,
          detail: [
            `Production: ${production}`,
            `Department: ${department}`,
            `Document type: ${documentType}`,
            `Records in this group: ${records.length}`,
            first.venue ? `Venue: ${first.venue}` : '',
            first.season ? `Season: ${first.season}` : '',
          ].filter(Boolean).join('. ') + '.',
          tags: [department, documentType.split(':')[0], `${records.length} records`],
        }
      })

    if (nodes.length === 0) {
      nodes.push({
        id: `project-${project.id}`,
        title: production,
        kind: 'Production',
        x: 55,
        y: 115,
        tone: position.tone,
        summary: project.description || 'Production project record.',
        source: 'Supabase project record',
        updated: 'Project record',
        detail: project.description || `Production: ${production}.`,
        tags: ['Production'],
      })
    }

    return {
      id: `season-${index + 1}`,
      title: project.name.split(':')[0] || `Season ${index + 1}`,
      eyebrow: `${production} · ${matchingDocs.length} documents`,
      x: position.x,
      y: position.y,
      width: position.width,
      height: 430,
      tone: position.tone,
      nodes,
    }
  })

  if (people.length > 0) {
    seasons.push({
      id: 'people',
      title: 'People',
      eyebrow: `${people.length} workspace profiles`,
      x: 1110,
      y: 625,
      width: 430,
      height: 300,
      tone: 'indigo',
      nodes: people.map((person, index) => ({
        id: `person-${person.uid}`,
        title: person.displayName || person.email || 'Workspace member',
        kind: person.department || 'Workspace profile',
        x: 28 + (index % 2) * 205,
        y: 88 + Math.floor(index / 2) * 88,
        tone: 'indigo',
        summary: `${person.department || 'Unassigned department'} workspace profile.`,
        source: 'Supabase employee profile',
        updated: 'Workspace profile',
        detail: [
          `Name: ${person.displayName || 'Not provided'}`,
          `Department: ${person.department || 'Not provided'}`,
          `Role: ${person.role}`,
          'No document authorship or production assignment is recorded for this profile.',
        ].join('. ') + '.',
        tags: [person.department || 'Workspace', person.role],
      })),
    })
  }

  return seasons
}

function buildRelationships(clusters: Cluster[]): Relationship[] {
  const edges: Relationship[] = []
  const seasonClusters = clusters.filter((cluster) => cluster.id !== 'people')

  for (let i = 0; i < seasonClusters.length; i++) {
    for (let j = i + 1; j < seasonClusters.length; j++) {
      const left = seasonClusters[i]
      const right = seasonClusters[j]

      left.nodes.forEach((a) => {
        if (!a.department) return
        const match = right.nodes.find((b) => b.department === a.department)
        if (!match) return

        edges.push({
          id: `shared-${a.id}-${match.id}`,
          sourceId: a.id,
          targetId: match.id,
          label: 'Recurring department',
          status: 'proposed',
          reason: `Both seasons contain records labeled "${a.department}". This suggests potentially reusable knowledge across productions, but does not establish that the same person worked on both.`,
          sources: [
            `${left.title}: ${a.title}`,
            `${right.title}: ${match.title}`,
          ],
          evidenceType: 'Inferred relevance',
          confidence: 'Medium',
        })
      })
    }
  }

  return edges
}

function Icon({
  name,
  size = 18,
}: {
  name: 'search' | 'plus' | 'minus' | 'target' | 'route' | 'close' | 'spark' | 'arrow' | 'file' | 'person' | 'check'
  size?: number
}) {
  const paths = {
    search: <><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    minus: <path d="M5 12h14" />,
    target: <><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2" /></>,
    route: <><circle cx="6" cy="17" r="2" /><circle cx="18" cy="7" r="2" /><path d="M8 17h3a3 3 0 0 0 3-3v-4a3 3 0 0 1 3-3" /></>,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    spark: <path d="m12 3 1.3 4.2a5 5 0 0 0 3.3 3.3L21 12l-4.4 1.5a5 5 0 0 0-3.2 3.2L12 21l-1.4-4.3a5 5 0 0 0-3.2-3.2L3 12l4.4-1.5a5 5 0 0 0 3.3-3.3L12 3Z" />,
    arrow: <path d="m9 18 6-6-6-6" />,
    file: <><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v5h4M10 13h5M10 17h5" /></>,
    person: <><circle cx="12" cy="8" r="3" /><path d="M6.5 20c.4-4 2.2-6 5.5-6s5.1 2 5.5 6" /></>,
    check: <path d="m5 12 4 4L19 6" />,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function App({ projects, documents, people, displayName, onSignOut }: KnowledgeAtlasProps) {
  const clusters = useMemo(
    () => buildClusters(projects, documents, people),
    [projects, documents, people],
  )
  const allNodes = useMemo(() => clusters.flatMap((cluster) => cluster.nodes), [clusters])
  const nodeById = useMemo(() => new Map(allNodes.map((node) => [node.id, node])), [allNodes])
  const clusterByNodeId = useMemo(
    () => new Map(clusters.flatMap((cluster) =>
      cluster.nodes.map((node) => [node.id, cluster.id] as const),
    )),
    [clusters],
  )
  const [relationships, setRelationships] = useState<Relationship[]>(() => buildRelationships(clusters))

  const getNodeName = (id: string) =>
    id === 'current-task' ? 'Four Seasons of Theatre' : nodeById.get(id)?.title

  const getNodePoint = (id: string) => {
    if (id === 'current-task') return { x: 800, y: 512 }
    const node = nodeById.get(id)
    const cluster = clusters.find((item) => item.nodes.some((candidate) => candidate.id === id))
    if (!node || !cluster) return null
    return { x: cluster.x + node.x + 102, y: cluster.y + node.y + 34 }
  }

  const [expanded, setExpanded] = useState<string[]>([])
  const [hovered, setHovered] = useState<string | null>(null)
  const [selected, setSelected] = useState<KnowledgeNode | null>(null)
  const [selectedRelationshipId, setSelectedRelationshipId] = useState<string | null>(null)
  const [hoveredRelationshipId, setHoveredRelationshipId] = useState<string | null>(null)
  const [rejectingRelationshipIds, setRejectingRelationshipIds] = useState<string[]>([])
  const [feedbackHistory, setFeedbackHistory] = useState<FeedbackRecord[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [view, setView] = useState({ x: 0, y: 0, scale: 0.82 })
  const [pathway, setPathway] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null)
  const projectCount = projects.length
  const userInitials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const visibleClusters = useMemo(
    () => new Set([
      ...expanded,
      ...(hovered ? [hovered] : []),
      ...(pathway ? clusters.map((cluster) => cluster.id) : []),
    ]),
    [expanded, hovered, pathway],
  )
  const selectedRelationship = relationships.find((relationship) => relationship.id === selectedRelationshipId) ?? null
  const activeRelationshipId = selectedRelationshipId ?? hoveredRelationshipId
  const activeRelationship = relationships.find((relationship) => relationship.id === activeRelationshipId)
  const highlightedNodeIds = new Set(activeRelationship ? [activeRelationship.sourceId, activeRelationship.targetId] : [])

  const pendingCountForCluster = (clusterId: string) => relationships.filter((relationship) => {
    if (relationship.status !== 'proposed') return false
    return clusterByNodeId.get(relationship.sourceId) === clusterId || clusterByNodeId.get(relationship.targetId) === clusterId
  }).length

  const isEndpointVisible = (id: string) => {
    if (id === 'current-task') return true
    const clusterId = clusterByNodeId.get(id)
    return Boolean(clusterId && visibleClusters.has(clusterId))
  }

  const showNotice = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(null), 2400)
  }

  const reviewRelationship = (relationship: Relationship, action: 'accepted' | 'rejected') => {
    if (action === 'accepted') {
      setRelationships((current) => current.map((item) =>
        item.id === relationship.id ? { ...item, status: 'confirmed' } : item,
      ))
    } else {
      setRejectingRelationshipIds((current) => [...current, relationship.id])
      window.setTimeout(() => {
        setRelationships((current) => current.map((item) =>
          item.id === relationship.id ? { ...item, status: 'rejected' } : item,
        ))
        setRejectingRelationshipIds((current) => current.filter((id) => id !== relationship.id))
      }, 320)
    }
    setFeedbackHistory((current) => [...current, {
      relationshipId: relationship.id,
      sourceId: relationship.sourceId,
      targetId: relationship.targetId,
      userId: 'maya',
      action,
      timestamp: new Date().toISOString(),
      evidenceType: relationship.evidenceType,
      originalConfidence: relationship.confidence,
    }])
    setSelectedRelationshipId(null)
    showNotice(action === 'accepted' ? 'Relationship confirmed' : 'Suggestion removed')
  }

  const toggleCluster = (id: string) => {
    setExpanded((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    setView((current) => ({ ...current, scale: Math.min(1.35, Math.max(0.55, current.scale - event.deltaY * 0.0008)) }))
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button, input, .cluster-card, .knowledge-node, .relationship-group')) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { x: event.clientX, y: event.clientY, vx: view.x, vy: view.y }
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    setView((current) => ({
      ...current,
      x: drag.current!.vx + event.clientX - drag.current!.x,
      y: drag.current!.vy + event.clientY - drag.current!.y,
    }))
  }

  const onPointerUp = () => { drag.current = null }
  const zoom = (amount: number) => setView((current) => ({ ...current, scale: Math.min(1.35, Math.max(0.55, current.scale + amount)) }))
  const resetView = () => setView({ x: 0, y: 0, scale: 0.82 })

  const selectNode = (node: KnowledgeNode) => {
    setSelected(node)
    setSelectedRelationshipId(null)
    const parent = clusters.find((cluster) => cluster.nodes.some((item) => item.id === node.id))
    if (parent && !expanded.includes(parent.id)) setExpanded((current) => [...current, parent.id])
  }

  const selectRelationship = (relationship: Relationship) => {
    if (relationship.status !== 'proposed') return
    setSelected(null)
    setSelectedRelationshipId(relationship.id)
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><span /><span /><span /></div>
          <span>Meridian</span>
        </div>
        <div className="workspace-title">
          <span>Knowledge atlas</span>
          <span className="divider">/</span>
          <strong>Theatre productions · {projectCount} seasons</strong>
        </div>
        <div className="top-actions">
          {searchOpen ? (
            <div className="search-field">
              <Icon name="search" size={16} />
              <input autoFocus placeholder="Search this atlas…" onBlur={() => setSearchOpen(false)} />
            </div>
          ) : (
            <button className="icon-button" onClick={() => setSearchOpen(true)} aria-label="Search atlas"><Icon name="search" /></button>
          )}
          <button className="avatar" aria-label={`Sign out ${displayName}`} onClick={onSignOut}>{userInitials}</button>
        </div>
      </header>

      <section
        className={`atlas ${drag.current ? 'is-dragging' : ''}`}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="atlas-hint"><span /> Drag to explore <span className="dot">·</span> Scroll to zoom</div>
        <div
          className="atlas-world"
          style={{ transform: `translate(calc(-50% + ${view.x}px), calc(-50% + ${view.y}px)) scale(${view.scale})` }}
        >
          <div className="ambient ambient-one" />
          <div className="ambient ambient-two" />

          <svg className="relationships" viewBox="0 0 1600 1000" role="group" aria-label="Knowledge relationships">
            {relationships.map((relationship) => {
              if (relationship.status === 'rejected' || !getNodeName(relationship.sourceId) || !getNodeName(relationship.targetId)) return null
              if (!isEndpointVisible(relationship.sourceId) || !isEndpointVisible(relationship.targetId)) return null
              const source = getNodePoint(relationship.sourceId)
              const target = getNodePoint(relationship.targetId)
              if (!source || !target) return null
              const midX = (source.x + target.x) / 2
              const midY = (source.y + target.y) / 2
              const bend = Math.min(65, Math.abs(target.x - source.x) * .12 + 20)
              const path = `M${source.x} ${source.y} C${source.x} ${source.y - bend} ${target.x} ${target.y - bend} ${target.x} ${target.y}`
              const isActive = activeRelationshipId === relationship.id
              return (
                <g
                  key={relationship.id}
                  className={`relationship-group ${relationship.status} ${isActive ? 'is-active' : ''} ${rejectingRelationshipIds.includes(relationship.id) ? 'is-rejecting' : ''}`}
                  onMouseEnter={() => setHoveredRelationshipId(relationship.id)}
                  onMouseLeave={() => setHoveredRelationshipId((current) => current === relationship.id ? null : current)}
                  onClick={(event) => { event.stopPropagation(); selectRelationship(relationship) }}
                  role={relationship.status === 'proposed' ? 'button' : 'img'}
                  tabIndex={relationship.status === 'proposed' ? 0 : -1}
                  aria-label={`${relationship.label}: ${getNodeName(relationship.sourceId)} to ${getNodeName(relationship.targetId)}. ${relationship.status}`}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') selectRelationship(relationship)
                  }}
                >
                  <path className="relationship-hit" d={path} />
                  <path className={`relation ${relationship.status} ${pathway && relationship.targetId === 'current-task' ? 'path-active' : ''}`} d={path} />
                  {relationship.status === 'proposed' && <circle className="ai-indicator" cx={midX} cy={midY - 2} r="5" />}
                  <g className="relationship-label" transform={`translate(${midX}, ${midY - 13})`}>
                    <rect x="-70" y="-11" width="140" height="22" rx="10" />
                    <text textAnchor="middle" dominantBaseline="middle">{relationship.label}</text>
                  </g>
                </g>
              )
            })}
          </svg>

          <button className={`task-node ${highlightedNodeIds.has('current-task') ? 'is-endpoint' : ''}`} onClick={() => {
            setSelected({
              id: 'current-task',
              title: 'Theatre production tasks',
              kind: 'Planning checklist',
              x: 0,
              y: 0,
              tone: 'indigo',
              summary: 'A shared planning pathway across four theatre seasons.',
              source: 'Demo planning checklist',
              updated: 'Suggested planning steps',
              detail: 'These are proposed next steps, not verified completed tasks.',
              tags: ['Suggested', 'Planning'],
            })
            setSelectedRelationshipId(null)
          }}>
            <span className="task-kicker"><Icon name="spark" size={15} /> Current task</span>
            <span className="task-title">Explore four seasons<br />of theatre</span>
            <span className="task-meta"><span className="pulse" /> Theatre case study <span>·</span> {projectCount} project records</span>
          </button>

          {clusters.map((cluster) => {
            const isOpen = visibleClusters.has(cluster.id)
            const isLocked = expanded.includes(cluster.id)
            const pendingCount = pendingCountForCluster(cluster.id)
            return (
              <div
                key={cluster.id}
                className={`cluster cluster-${cluster.tone} ${isOpen ? 'is-open' : ''}`}
                style={{ left: cluster.x, top: cluster.y, width: cluster.width, height: cluster.height }}
                onMouseEnter={() => setHovered(cluster.id)}
                onMouseLeave={() => setHovered((current) => current === cluster.id ? null : current)}
              >
                <button
                  className="cluster-card"
                  onClick={() => toggleCluster(cluster.id)}
                  aria-expanded={isOpen}
                >
                  <span className="cluster-glyph"><span /><span /><span /></span>
                  <span className="cluster-copy">
                    <span className="cluster-eyebrow">{pendingCount > 0 ? `${pendingCount} to review · ${cluster.eyebrow}` : cluster.eyebrow}</span>
                    <strong>{cluster.title}</strong>
                  </span>
                  <span className="cluster-action">{isLocked ? 'Pinned open' : isOpen ? 'Click to keep open' : 'Explore'} <Icon name="arrow" size={15} /></span>
                </button>
                <div className="cluster-boundary" />
                {cluster.nodes.map((node) => (
                  <button
                    key={node.id}
                    className={`knowledge-node node-${node.tone} ${selected?.id === node.id ? 'is-selected' : ''} ${highlightedNodeIds.has(node.id) ? 'is-endpoint' : ''}`}
                    style={{ left: node.x, top: node.y }}
                    onClick={() => selectNode(node)}
                    tabIndex={isOpen ? 0 : -1}
                  >
                    <span className="node-icon">{node.kind === 'Treasurer' || node.kind.includes('Liaison') || node.kind.includes('Chair') ? <Icon name="person" size={16} /> : <Icon name="file" size={16} />}</span>
                    <span><strong>{node.title}</strong><small>{node.kind}</small></span>
                  </button>
                ))}
              </div>
            )
          })}
        </div>

        <div className="pathway-control">
          <button className={pathway ? 'active' : ''} onClick={() => setPathway((current) => !current)}>
            <Icon name="route" size={17} />
            <span>Task pathway</span>
            <span className="switch"><span /></span>
          </button>
        </div>

        <div className="zoom-controls">
          <button onClick={() => zoom(0.1)} aria-label="Zoom in"><Icon name="plus" size={17} /></button>
          <button onClick={() => zoom(-0.1)} aria-label="Zoom out"><Icon name="minus" size={17} /></button>
          <button onClick={resetView} aria-label="Center atlas"><Icon name="target" size={17} /></button>
          <span>{Math.round(view.scale * 100)}%</span>
        </div>
      </section>

      <aside className={`detail-panel ${selected || selectedRelationship ? 'is-visible' : ''}`} aria-hidden={!selected && !selectedRelationship}>
        {selectedRelationship ? <>
          <div className="panel-header">
            <span className="panel-type"><span className="ai-status-mark"><Icon name="spark" size={12} /></span>AI-suggested relationship</span>
            <button className="icon-button" onClick={() => setSelectedRelationshipId(null)} aria-label="Close relationship details"><Icon name="close" /></button>
          </div>
          <div className="panel-body relationship-panel">
            <div className="relationship-status"><span />Proposed</div>
            <div className="relationship-pair">
              <strong>{getNodeName(selectedRelationship.sourceId)}</strong>
              <span><Icon name="arrow" size={14} /> {selectedRelationship.label}</span>
              <strong>{getNodeName(selectedRelationship.targetId)}</strong>
            </div>
            <div className="panel-section">
              <h3>Why suggested</h3>
              <p>{selectedRelationship.reason}</p>
              {selectedRelationship.evidenceType === 'Inferred relevance' && (
                <div className="inference-note"><Icon name="spark" size={14} /><span><strong>Inferred relevance</strong>This connection is suggested by AI. It is not explicitly stated in the source material.</span></div>
              )}
            </div>
            <div className="panel-section">
              <h3>Supporting sources</h3>
              <div className="source-list">
                {selectedRelationship.sources.map((source) => (
                  <div className="source-card" key={source}>
                    <span className="source-icon"><Icon name="file" size={17} /></span>
                    <span><strong>{source}</strong><small>Supporting evidence</small></span>
                  </div>
                ))}
              </div>
            </div>
            <div className="panel-section relationship-facts">
              <h3>Suggestion details</h3>
              <dl>
                <div><dt>Status</dt><dd>Proposed</dd></div>
                <div><dt>Evidence type</dt><dd>{selectedRelationship.evidenceType}</dd></div>
                {selectedRelationship.confidence && <div><dt>AI confidence</dt><dd>{selectedRelationship.confidence}</dd></div>}
              </dl>
            </div>
            <p className="feedback-note">Your review is recorded separately and may improve future recommendations. Confirmation does not verify the underlying information.</p>
          </div>
          <div className="panel-footer review-footer">
            <button className="reject-button" onClick={() => reviewRelationship(selectedRelationship, 'rejected')} aria-label="Reject suggested relationship"><Icon name="close" size={17} />Reject</button>
            <button className="accept-button" onClick={() => reviewRelationship(selectedRelationship, 'accepted')} aria-label="Accept suggested relationship"><Icon name="check" size={17} />Accept</button>
          </div>
        </> : selected ? <>
          <div className="panel-header">
            <span className="panel-type"><span className={`type-dot dot-${selected.tone}`} />{selected.kind}</span>
            <button className="icon-button" onClick={() => setSelected(null)} aria-label="Close details"><Icon name="close" /></button>
          </div>
          <div className="panel-body">
            <h2>{selected.title}</h2>
            <p className="panel-summary">{selected.summary}</p>
            <div className="tag-row">{selected.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
            {selected.id === 'current-task' && (
              <div className="panel-section">
                <h3>Four-season planning checklist</h3>
                <p>Suggested actions · Check items during your planning walkthrough</p>
                <div className="task-checklist">
                  <label><input type="checkbox" /> Review records from previous seasons</label>
                  <label><input type="checkbox" /> Confirm venue and production requirements</label>
                  <label><input type="checkbox" /> Build a production budget within the season's approved ceiling</label>
                  <label><input type="checkbox" /> Identify owners for production decisions</label>
                  <label><input type="checkbox" /> Track contingency separately from the main budget</label>
                  <label><input type="checkbox" /> Record decisions and preserve supporting documents</label>
                </div>
                <p className="feedback-note">Checklist is a demo planning aid; checked items are not saved to Supabase.</p>
              </div>
            )}
            <div className="panel-section">
              <h3>What Meridian knows</h3>
              <p>{selected.detail}</p>
            </div>
            <div className="panel-section evidence">
              <h3>Source</h3>
              <div className="source-card">
                <span className="source-icon"><Icon name="file" size={18} /></span>
                <span><strong>{selected.source}</strong><small>{selected.updated}</small></span>
                <Icon name="arrow" size={16} />
              </div>
            </div>
            <div className="panel-section">
              <h3>Relationship to task</h3>
              <div className="relationship-summary">
                <div className="mini-task"><Icon name="spark" size={14} /></div>
                <div className="relation-stem"><span /></div>
                <div className={`mini-node mini-${selected.tone}`} />
                <p><strong>Directly informs</strong><br />Prepare this year’s sponsorship proposal</p>
              </div>
            </div>
          </div>
          <div className="panel-footer">
            <button>Open source <Icon name="arrow" size={16} /></button>
          </div>
        </> : null}
      </aside>
      <div className={`notice ${notice ? 'is-visible' : ''}`} role="status">
        <Icon name="check" size={15} />{notice}
        {feedbackHistory.length > 0 && <span className="sr-only">{feedbackHistory.length} review actions recorded</span>}
      </div>
    </main>
  )
}

export default App
