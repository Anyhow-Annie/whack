import { Background, Controls, ReactFlow, useEdgesState, useNodesState, type Edge, type Node } from '@xyflow/react'
import { useEffect } from 'react'
import '@xyflow/react/dist/style.css'

type KnowledgeMapProps = {
  nodes: Node[]
  edges: Edge[]
}

export function KnowledgeMap({ nodes, edges }: KnowledgeMapProps) {
  const [flowNodes, setNodes, onNodesChange] = useNodesState(nodes)
  const [flowEdges, setEdges, onEdgesChange] = useEdgesState(edges)

  useEffect(() => {
    setNodes(nodes)
    setEdges(edges)
  }, [nodes, edges, setNodes, setEdges])

  if (nodes.length === 0) {
    return <p className="status">Projects you can access will show up here as a map.</p>
  }

  return (
    <div className="map">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  )
}
