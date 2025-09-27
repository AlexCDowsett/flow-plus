// Circular Layout Method
// Arranges cells in circular patterns for complex interconnected flows

// Constants for circular layout
const CIRCULAR_CONFIG = {
  centerX: 0,
  centerY: 0,
  baseRadius: 1000,
  radiusIncrement: 500,
  angleOffset: 100,
  minDistance: 1000
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
 * Analyze flow structure to determine circular arrangement
 */
const analyzeFlowStructure = (cells, connections) => {
  const adjacencyList = new Map();
  const inDegree = new Map();
  const outDegree = new Map();
  
  // Initialize
  cells.forEach(cell => {
    adjacencyList.set(cell.id, []);
    inDegree.set(cell.id, 0);
    outDegree.set(cell.id, 0);
  });

  // Build graph and calculate degrees
  connections.forEach(conn => {
    if (adjacencyList.has(conn.from) && adjacencyList.has(conn.to)) {
      adjacencyList.get(conn.from).push(conn.to);
      inDegree.set(conn.to, inDegree.get(conn.to) + 1);
      outDegree.set(conn.from, outDegree.get(conn.from) + 1);
    }
  });

  // Categorize cells by their role
  const startCells = cells.filter(cell => inDegree.get(cell.id) === 0);
  const endCells = cells.filter(cell => outDegree.get(cell.id) === 0);
  const hubCells = cells.filter(cell => 
    inDegree.get(cell.id) > 2 || outDegree.get(cell.id) > 2
  );
  const regularCells = cells.filter(cell => 
    inDegree.get(cell.id) <= 2 && outDegree.get(cell.id) <= 2 &&
    inDegree.get(cell.id) > 0 && outDegree.get(cell.id) > 0
  );

  console.log('📊 Flow analysis:');
  console.log(`  Start cells: ${startCells.length}`);
  console.log(`  End cells: ${endCells.length}`);
  console.log(`  Hub cells: ${hubCells.length}`);
  console.log(`  Regular cells: ${regularCells.length}`);

  return { startCells, endCells, hubCells, regularCells, adjacencyList };
};

/**
 * Position cells in circular arrangement
 */
const positionCircularCells = (cells, structure) => {
  const { startCells, endCells, hubCells, regularCells } = structure;
  const positionedCells = [];
  
  // Position start cells at the top
  startCells.forEach((cell, index) => {
    const angle = (index / Math.max(startCells.length, 1)) * Math.PI * 0.5;
    const x = CIRCULAR_CONFIG.centerX + Math.cos(angle) * CIRCULAR_CONFIG.baseRadius;
    const y = CIRCULAR_CONFIG.centerY - Math.sin(angle) * CIRCULAR_CONFIG.baseRadius;
    
    positionedCells.push({
      ...cell,
      canvas: {
        ...cell.canvas,
        position: { x, y }
      }
    });
  });
  
  // Position hub cells in the center
  hubCells.forEach((cell, index) => {
    const angle = (index / Math.max(hubCells.length, 1)) * Math.PI * 2;
    const radius = CIRCULAR_CONFIG.baseRadius * 0.3;
    const x = CIRCULAR_CONFIG.centerX + Math.cos(angle) * radius;
    const y = CIRCULAR_CONFIG.centerY + Math.sin(angle) * radius;
    
    positionedCells.push({
      ...cell,
      canvas: {
        ...cell.canvas,
        position: { x, y }
      }
    });
  });
  
  // Position regular cells in outer ring
  regularCells.forEach((cell, index) => {
    const angle = (index / Math.max(regularCells.length, 1)) * Math.PI * 2;
    const radius = CIRCULAR_CONFIG.baseRadius + CIRCULAR_CONFIG.radiusIncrement;
    const x = CIRCULAR_CONFIG.centerX + Math.cos(angle) * radius;
    const y = CIRCULAR_CONFIG.centerY + Math.sin(angle) * radius;
    
    positionedCells.push({
      ...cell,
      canvas: {
        ...cell.canvas,
        position: { x, y }
      }
    });
  });
  
  // Position end cells at the bottom
  endCells.forEach((cell, index) => {
    const angle = Math.PI + (index / Math.max(endCells.length, 1)) * Math.PI * 0.5;
    const x = CIRCULAR_CONFIG.centerX + Math.cos(angle) * CIRCULAR_CONFIG.baseRadius;
    const y = CIRCULAR_CONFIG.centerY - Math.sin(angle) * CIRCULAR_CONFIG.baseRadius;
    
    positionedCells.push({
      ...cell,
      canvas: {
        ...cell.canvas,
        position: { x, y }
      }
    });
  });
  
  return positionedCells;
};


/**
 * Circular Layout Method - Circular arrangement for complex interconnected flows
 * @param {Object} data - The flow data object
 * @returns {Object} - Flow data with circular layout
 */
export const circularLayout = (data) => {
  if (!data?.cells) {
    console.error('❌ Invalid data provided to circularLayout');
    return data;
  }

  console.log('🔧 Starting circular layout for data:', data.scriptName);
  
  try {
    const { filteredCells, connections } = processCells(data);
    const structure = analyzeFlowStructure(filteredCells, connections);
    const positionedCells = positionCircularCells(filteredCells, structure);
    
    console.log('✅ Circular layout complete!');
    console.log('📊 Final cell count:', positionedCells.length);
    
    return { ...data, cells: positionedCells };
  } catch (error) {
    console.error('❌ Error in circularLayout:', error);
    return data;
  }
};
