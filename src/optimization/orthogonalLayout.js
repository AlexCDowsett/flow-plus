// Orthogonal Layout Method
// Creates clean orthogonal routing with proper U-shaped rerouting for backward connections

// Constants for orthogonal layout
const ORTHOGONAL_CONFIG = {
  cellSpacing: 200,
  levelSpacing: 300,
  startX: 100,
  startY: 200,
  gridSize: 50,
  uShapeHeight: 120,
  rerouteSpacing: 80
};

/**
 * Process cells and extract connections
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
 * Assign levels for orthogonal positioning
 */
const assignOrthogonalLevels = (cells, connections) => {
  const adjacencyList = new Map();
  const inDegree = new Map();
  const levels = new Map();
  const levelGroups = new Map();
  
  // Initialize
  cells.forEach(cell => {
    adjacencyList.set(cell.id, []);
    inDegree.set(cell.id, 0);
  });

  // Build graph
  connections.forEach(conn => {
    if (adjacencyList.has(conn.from) && adjacencyList.has(conn.to)) {
      adjacencyList.get(conn.from).push(conn.to);
      inDegree.set(conn.to, inDegree.get(conn.to) + 1);
    }
  });

  // Find start nodes
  const startNodes = cells.filter(cell => inDegree.get(cell.id) === 0);
  const startNode = startNodes.find(cell => cell.type === -1) || startNodes[0];
  
  if (!startNode) {
    console.warn('⚠️ No start node found, using first cell');
    startNodes.push(cells[0]);
  }

  // Assign levels
  const queue = startNodes.map(node => ({ cell: node, level: 0 }));
  const visited = new Set();

  while (queue.length > 0) {
    const { cell, level } = queue.shift();
    
    if (visited.has(cell.id)) continue;
    visited.add(cell.id);
    
    levels.set(cell.id, level);
    
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

  // Handle unvisited nodes
  cells.forEach(cell => {
    if (!visited.has(cell.id)) {
      const level = 0;
      levels.set(cell.id, level);
      if (!levelGroups.has(level)) {
        levelGroups.set(level, []);
      }
      levelGroups.get(level).push(cell.id);
    }
  });

  return { levels, levelGroups };
};

/**
 * Position cells on orthogonal grid
 */
const positionOrthogonalCells = (cells, levels, levelGroups) => {
  return cells.map(cell => {
    const level = levels.get(cell.id) || 0;
    const levelCells = levelGroups.get(level) || [];
    const cellIndex = levelCells.indexOf(cell.id);
    
    // Align to grid
    const x = Math.round((ORTHOGONAL_CONFIG.startX + level * ORTHOGONAL_CONFIG.levelSpacing) / ORTHOGONAL_CONFIG.gridSize) * ORTHOGONAL_CONFIG.gridSize;
    const y = Math.round((ORTHOGONAL_CONFIG.startY + (cellIndex - (levelCells.length - 1) / 2) * ORTHOGONAL_CONFIG.cellSpacing) / ORTHOGONAL_CONFIG.gridSize) * ORTHOGONAL_CONFIG.gridSize;

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
 * Orthogonal Layout Method - Clean orthogonal routing with U-shaped rerouting
 * @param {Object} data - The flow data object
 * @returns {Object} - Flow data with orthogonal layout
 */
export const orthogonalLayout = (data) => {
  if (!data?.cells) {
    console.error('❌ Invalid data provided to orthogonalLayout');
    return data;
  }

  console.log('🔧 Starting orthogonal layout for data:', data.scriptName);
  
  try {
    const { filteredCells, connections } = processCells(data);
    const { levels, levelGroups } = assignOrthogonalLevels(filteredCells, connections);
    const positionedCells = positionOrthogonalCells(filteredCells, levels, levelGroups);
    
    console.log('✅ Orthogonal layout complete!');
    console.log('📊 Final cell count:', positionedCells.length);
    
    return { ...data, cells: positionedCells };
  } catch (error) {
    console.error('❌ Error in orthogonalLayout:', error);
    return data;
  }
};
