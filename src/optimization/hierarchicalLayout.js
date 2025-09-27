// Hierarchical Layout Method
// Focuses on clear flow structure with proper U-shaped rerouting for readability

// Constants for layout configuration
const LAYOUT_CONFIG = {
  cellSpacing: 180,
  levelSpacing: 300,
  startX: 100,
  startY: 200,
  rerouteSpacing: 100,
  uShapeHeight: 150
};

/**
 * Process cells and extract connections, filtering out type 24 cells
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
 * Build hierarchical structure with proper level assignment
 */
const buildHierarchy = (cells, connections) => {
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

  // Assign levels using BFS
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

  // Handle unvisited nodes (cycles)
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

  console.log('📊 Hierarchy levels:', Array.from(levelGroups.keys()).length);
  return { levels, levelGroups, adjacencyList };
};

/**
 * Position cells in hierarchical structure
 */
const positionHierarchicalCells = (cells, levels, levelGroups) => {
  return cells.map(cell => {
    const level = levels.get(cell.id) || 0;
    const levelCells = levelGroups.get(level) || [];
    const cellIndex = levelCells.indexOf(cell.id);
    
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
 * Hierarchical Layout Method - Clear flow structure with intelligent rerouting
 * @param {Object} data - The flow data object
 * @returns {Object} - Flow data with hierarchical layout
 */
export const hierarchicalLayout = (data) => {
  if (!data?.cells) {
    console.error('❌ Invalid data provided to hierarchicalLayout');
    return data;
  }

  console.log('🔧 Starting hierarchical layout for data:', data.scriptName);
  
  try {
    const { filteredCells, connections } = processCells(data);
    const { levels, levelGroups, adjacencyList } = buildHierarchy(filteredCells, connections);
    const positionedCells = positionHierarchicalCells(filteredCells, levels, levelGroups);
    
    console.log('✅ Hierarchical layout complete!');
    console.log('📊 Final cell count:', positionedCells.length);
    
    return { ...data, cells: positionedCells };
  } catch (error) {
    console.error('❌ Error in hierarchicalLayout:', error);
    return data;
  }
};
