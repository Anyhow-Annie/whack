import type { Edge, Node } from '@xyflow/react'
import type { KnowledgeRelationship, OrgDocument, Project } from '../types/domain'

export function buildKnowledgeGraph(
  projects: Project[],
  documents: OrgDocument[],
  relationships: KnowledgeRelationship[],
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [
    ...projects.map((project, index) => ({
      id: `project:${project.id}`,
      position: { x: 40, y: index * 120 },
      data: { label: project.name },
    })),
    ...documents.map((document, index) => ({
      id: `document:${document.id}`,
      position: { x: 420, y: index * 100 },
      data: { label: document.title },
    })),
  ]

  const ids = new Set(nodes.map((node) => node.id))
  const edges = relationships.flatMap((relationship) => {
    const source = `${relationship.fromType}:${relationship.fromId}`
    const target = `${relationship.toType}:${relationship.toId}`
    if (!ids.has(source) || !ids.has(target)) return []
    return [{
      id: relationship.id,
      source,
      target,
      label: relationship.kind.replaceAll('_', ' '),
    }]
  })

  return { nodes, edges }
}
