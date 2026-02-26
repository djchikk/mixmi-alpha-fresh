import { GraphNode, GraphEdge, GraphData } from './types';

const NODES: GraphNode[] = [
  // SEED
  {
    id: 'seed-001', title: 'Desert Dawn', artist: 'Amira K.', type: 'seed',
    generation: 0, location: 'Nairobi, Kenya', stems: ['drums', 'bass', 'synth', 'vocal'],
    parentId: null, downloads: 347, remixCount: 4, splitPercent: 40.96,
  },

  // GENERATION 1
  {
    id: 'rmx-101', title: 'Desert Dawn (Santiago Dub)', artist: 'Felipe M.', type: 'remix',
    generation: 1, location: 'Santiago, Chile', stems: ['drums', 'bass', 'guitar'],
    parentId: 'seed-001', downloads: 182, remixCount: 2, splitPercent: 20,
  },
  {
    id: 'rmx-102', title: 'Dawn Riddim', artist: 'Bunny J.', type: 'remix',
    generation: 1, location: 'Kingston, Jamaica', stems: ['drums', 'vocal', 'horn'],
    parentId: 'seed-001', downloads: 256, remixCount: 1, splitPercent: 15,
  },
  {
    id: 'rmx-103', title: 'Desert Dawn (Mumbai Mix)', artist: 'Priya S.', type: 'remix',
    generation: 1, location: 'Mumbai, India', stems: ['synth', 'vocal', 'tabla'],
    parentId: 'seed-001', downloads: 134, remixCount: 0, splitPercent: 12,
  },
  {
    id: 'rmx-104', title: 'London Bass Refix', artist: 'DJ Nova', type: 'remix',
    generation: 1, location: 'London, UK', stems: ['bass', 'drums', 'synth'],
    parentId: 'seed-001', downloads: 298, remixCount: 1, splitPercent: 18,
  },

  // GENERATION 2
  {
    id: 'rmx-201', title: 'Mapuche Dawn', artist: 'Lautaro C.', type: 'remix',
    generation: 2, location: 'Temuco, Chile', stems: ['drums', 'guitar', 'kultrún'],
    parentId: 'rmx-101', downloads: 89, remixCount: 0, splitPercent: 8,
  },
  {
    id: 'rmx-202', title: 'Buenos Aires Nocturna', artist: 'Valentina R.', type: 'remix',
    generation: 2, location: 'Buenos Aires, Argentina', stems: ['bass', 'guitar', 'bandoneón'],
    parentId: 'rmx-101', downloads: 145, remixCount: 0, splitPercent: 10,
  },
  {
    id: 'rmx-203', title: 'Brummie Dub', artist: 'MC Roots', type: 'remix',
    generation: 2, location: 'Birmingham, UK', stems: ['drums', 'vocal', 'bass'],
    parentId: 'rmx-104', downloads: 167, remixCount: 0, splitPercent: 7,
  },
  {
    id: 'rmx-204', title: 'Himalayan Dawn', artist: 'Tashi D.', type: 'remix',
    generation: 2, location: 'Thimphu, Bhutan', stems: ['vocal', 'drums', 'yangchen'],
    parentId: 'rmx-102', downloads: 72, remixCount: 0, splitPercent: 5,
  },
];

function buildGraphData(): GraphData {
  const links: GraphEdge[] = [];

  // Build remix/attribution edges from parentId
  for (const node of NODES) {
    if (node.parentId) {
      // "Sampled From" edge: child → parent (attribution direction)
      links.push({
        source: node.id,
        target: node.parentId,
        type: 'sampled_from',
      });
      // "Payment Flow" edge: same direction (money flows to source)
      links.push({
        source: node.id,
        target: node.parentId,
        type: 'payment',
      });
    }
  }

  // Collaboration edge: Felipe ↔ DJ Nova
  links.push({
    source: 'rmx-101',
    target: 'rmx-104',
    type: 'collaborated',
  });

  return { nodes: NODES, links };
}

export const SAMPLE_DATA = buildGraphData();

// Helper: get all ancestors + descendants of a node
export function getConnectedIds(nodeId: string, nodes: GraphNode[]): Set<string> {
  const connected = new Set<string>();
  connected.add(nodeId);

  // Walk up ancestors
  const walkUp = (id: string) => {
    const node = nodes.find(n => n.id === id);
    if (node?.parentId) {
      connected.add(node.parentId);
      walkUp(node.parentId);
    }
  };
  walkUp(nodeId);

  // Walk down descendants
  const walkDown = (id: string) => {
    const children = nodes.filter(n => n.parentId === id);
    for (const child of children) {
      connected.add(child.id);
      walkDown(child.id);
    }
  };
  walkDown(nodeId);

  return connected;
}

// Helper: get nodes within N hops of a node
export function getNodesWithinHops(nodeId: string, nodes: GraphNode[], maxHops: number): Set<string> {
  const result = new Set<string>();
  result.add(nodeId);

  // Build adjacency from parentId (bidirectional)
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) {
    if (!adjacency.has(node.id)) adjacency.set(node.id, []);
    if (node.parentId) {
      if (!adjacency.has(node.parentId)) adjacency.set(node.parentId, []);
      adjacency.get(node.id)!.push(node.parentId);
      adjacency.get(node.parentId)!.push(node.id);
    }
  }

  // BFS
  let frontier = [nodeId];
  for (let hop = 0; hop < maxHops; hop++) {
    const nextFrontier: string[] = [];
    for (const id of frontier) {
      for (const neighbor of adjacency.get(id) || []) {
        if (!result.has(neighbor)) {
          result.add(neighbor);
          nextFrontier.push(neighbor);
        }
      }
    }
    frontier = nextFrontier;
  }

  return result;
}
