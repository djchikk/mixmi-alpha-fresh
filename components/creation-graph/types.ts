export type NodeType = 'seed' | 'remix' | 'stem' | 'artist';
export type EdgeType = 'sampled_from' | 'remixed_by' | 'collaborated' | 'payment';

export interface GraphNode {
  id: string;
  title: string;
  artist: string;
  type: NodeType;
  generation: number;
  location: string;
  stems: string[];
  parentId: string | null;
  downloads: number;
  remixCount: number;
  splitPercent: number;
  // Added by force-graph at runtime
  x?: number;
  y?: number;
  z?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: EdgeType;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphEdge[];
}

export const NODE_COLORS: Record<NodeType, string> = {
  seed: '#81E4F2',
  remix: '#A78BFA',
  stem: '#34D399',
  artist: '#FB923C',
};

export const EDGE_COLORS: Record<EdgeType, string> = {
  sampled_from: '#81E4F2',
  remixed_by: '#A78BFA',
  collaborated: '#FB923C',
  payment: '#FBBF24',
};

export const NODE_LABELS: Record<NodeType, string> = {
  seed: 'Seed',
  remix: 'Remix',
  stem: 'Stem',
  artist: 'Artist',
};

export const EDGE_LABELS: Record<EdgeType, string> = {
  sampled_from: 'Sampled From',
  remixed_by: 'Remixed By',
  collaborated: 'Collaborated With',
  payment: 'Payment Flow',
};
