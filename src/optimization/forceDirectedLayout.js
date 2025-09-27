// Force-Directed Layout Method
// Uses physics simulation to create natural clustering and readable layouts

// Constants for force simulation
const FORCE_CONFIG = {
  repulsionStrength: 1000,
  attractionStrength: 0.1,
  centerStrength: 0.01,
  damping: 0.9,
  iterations: 100,
  minDistance: 120,
  maxDistance: 300
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
 * Initialize cell positions randomly
 */
const initializePositions = (cells) => {
  const centerX = 400;
  const centerY = 300;
  const radius = 200;
  
  return cells.map((cell, index) => {
    const angle = (index / cells.length) * 2 * Math.PI;
    const distance = Math.random() * radius;
    
    return {
      ...cell,
      canvas: {
        ...cell.canvas,
        position: {
          x: centerX + Math.cos(angle) * distance,
          y: centerY + Math.sin(angle) * distance
        }
      },
      velocity: { x: 0, y: 0 }
    };
  });
};

/**
 * Calculate repulsion force between cells
 */
const calculateRepulsion = (cell1, cell2) => {
  const dx = cell1.canvas.position.x - cell2.canvas.position.x;
  const dy = cell1.canvas.position.y - cell2.canvas.position.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  if (distance === 0) return { x: 0, y: 0 };
  
  const force = FORCE_CONFIG.repulsionStrength / (distance * distance);
  return {
    x: (dx / distance) * force,
    y: (dy / distance) * force
  };
};

/**
 * Calculate attraction force between connected cells
 */
const calculateAttraction = (cell1, cell2, idealDistance) => {
  const dx = cell2.canvas.position.x - cell1.canvas.position.x;
  const dy = cell2.canvas.position.y - cell1.canvas.position.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  if (distance === 0) return { x: 0, y: 0 };
  
  const force = FORCE_CONFIG.attractionStrength * (distance - idealDistance);
  return {
    x: (dx / distance) * force,
    y: (dy / distance) * force
  };
};

/**
 * Calculate center force to keep cells in view
 */
const calculateCenterForce = (cell, centerX, centerY) => {
  const dx = centerX - cell.canvas.position.x;
  const dy = centerY - cell.canvas.position.y;
  
  return {
    x: dx * FORCE_CONFIG.centerStrength,
    y: dy * FORCE_CONFIG.centerStrength
  };
};

/**
 * Apply force simulation
 */
const applyForceSimulation = (cells, connections) => {
  const centerX = 400;
  const centerY = 300;
  
  for (let iteration = 0; iteration < FORCE_CONFIG.iterations; iteration++) {
    // Calculate forces for each cell
    cells.forEach(cell => {
      let totalForceX = 0;
      let totalForceY = 0;
      
      // Repulsion from other cells
      cells.forEach(otherCell => {
        if (cell.id !== otherCell.id) {
          const repulsion = calculateRepulsion(cell, otherCell);
          totalForceX += repulsion.x;
          totalForceY += repulsion.y;
        }
      });
      
      // Attraction to connected cells
      connections.forEach(conn => {
        if (conn.from === cell.id) {
          const targetCell = cells.find(c => c.id === conn.to);
          if (targetCell) {
            const attraction = calculateAttraction(cell, targetCell, FORCE_CONFIG.minDistance);
            totalForceX += attraction.x;
            totalForceY += attraction.y;
          }
        } else if (conn.to === cell.id) {
          const sourceCell = cells.find(c => c.id === conn.from);
          if (sourceCell) {
            const attraction = calculateAttraction(cell, sourceCell, FORCE_CONFIG.minDistance);
            totalForceX += attraction.x;
            totalForceY += attraction.y;
          }
        }
      });
      
      // Center force
      const centerForce = calculateCenterForce(cell, centerX, centerY);
      totalForceX += centerForce.x;
      totalForceY += centerForce.y;
      
      // Update velocity
      cell.velocity.x = (cell.velocity.x + totalForceX) * FORCE_CONFIG.damping;
      cell.velocity.y = (cell.velocity.y + totalForceY) * FORCE_CONFIG.damping;
      
      // Update position
      cell.canvas.position.x += cell.velocity.x;
      cell.canvas.position.y += cell.velocity.y;
    });
  }
  
  return cells;
};


/**
 * Force-Directed Layout Method - Natural clustering with physics simulation
 * @param {Object} data - The flow data object
 * @returns {Object} - Flow data with force-directed layout
 */
export const forceDirectedLayout = (data) => {
  if (!data?.cells) {
    console.error('❌ Invalid data provided to forceDirectedLayout');
    return data;
  }

  console.log('🔧 Starting force-directed layout for data:', data.scriptName);
  
  try {
    const { filteredCells, connections } = processCells(data);
    const positionedCells = initializePositions(filteredCells);
    const simulatedCells = applyForceSimulation(positionedCells, connections);
    
    console.log('✅ Force-directed layout complete!');
    console.log('📊 Final cell count:', simulatedCells.length);
    
    return { ...data, cells: simulatedCells };
  } catch (error) {
    console.error('❌ Error in forceDirectedLayout:', error);
    return data;
  }
};
