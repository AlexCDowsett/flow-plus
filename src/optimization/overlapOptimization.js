// Overlap Optimization Module
// Detects overlapping connections and applies U/N-shaped rerouting to minimize overlaps

// Constants for overlap optimization
const OVERLAP_CONFIG = {
  minOverlapDistance: 20, // Minimum distance to consider as overlap
  uShapeHeight: 120, // Height of U-shape rerouting
  rerouteSpacing: 80, // Spacing between reroute cells
  gridSize: 50, // Grid alignment for reroute cells
  minConnectionLength: 150 // Minimum connection length to consider for rerouting
};

/**
 * Check if two line segments overlap
 * @param {Object} line1 - {x1, y1, x2, y2}
 * @param {Object} line2 - {x1, y1, x2, y2}
 * @returns {boolean} - True if lines overlap
 */
const doLinesOverlap = (line1, line2) => {
  // Calculate intersection point of two line segments
  const x1 = line1.x1, y1 = line1.y1, x2 = line1.x2, y2 = line1.y2;
  const x3 = line2.x1, y3 = line2.y1, x4 = line2.x2, y4 = line2.y2;
  
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 1e-10) return false; // Lines are parallel
  
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
  
  // Check if intersection point is within both line segments
  const hasIntersection = t >= 0 && t <= 1 && u >= 0 && u <= 1;
  
  if (!hasIntersection) return false;
  
  // Calculate intersection point
  const ix = x1 + t * (x2 - x1);
  const iy = y1 + t * (y2 - y1);
  
  // Check if intersection is within the overlap threshold
  const dist1 = Math.sqrt((ix - x1) * (ix - x1) + (iy - y1) * (iy - y1));
  const dist2 = Math.sqrt((ix - x2) * (ix - x2) + (iy - y2) * (iy - y2));
  const dist3 = Math.sqrt((ix - x3) * (ix - x3) + (iy - y3) * (iy - y3));
  const dist4 = Math.sqrt((ix - x4) * (ix - x4) + (iy - y4) * (iy - y4));
  
  const line1Length = Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
  const line2Length = Math.sqrt((x4 - x3) * (x4 - x3) + (y4 - y3) * (y4 - y3));
  
  // Check if intersection is not too close to endpoints
  const minDistFromEnds = OVERLAP_CONFIG.minOverlapDistance;
  return dist1 > minDistFromEnds && dist2 > minDistFromEnds && 
         dist3 > minDistFromEnds && dist4 > minDistFromEnds;
};

/**
 * Check if a connection is going from right to left
 * @param {Object} fromCell - Source cell
 * @param {Object} toCell - Target cell
 * @returns {boolean} - True if connection goes right to left
 */
const isRightToLeftConnection = (fromCell, toCell) => {
  return toCell.canvas.position.x < fromCell.canvas.position.x;
};

/**
 * Check if a connection is long enough to benefit from rerouting
 * @param {Object} fromCell - Source cell
 * @param {Object} toCell - Target cell
 * @returns {boolean} - True if connection is long enough
 */
const isLongEnoughForRerouting = (fromCell, toCell) => {
  const dx = Math.abs(toCell.canvas.position.x - fromCell.canvas.position.x);
  const dy = Math.abs(toCell.canvas.position.y - fromCell.canvas.position.y);
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance > OVERLAP_CONFIG.minConnectionLength;
};

/**
 * Calculate flow bounds (min/max Y coordinates)
 * @param {Array} cells - Array of flow cells
 * @returns {Object} - {minY, maxY, minX, maxX}
 */
const calculateFlowBounds = (cells) => {
  const nonRerouteCells = cells.filter(cell => cell.type !== 24);
  
  if (nonRerouteCells.length === 0) {
    return { minY: 0, maxY: 0, minX: 0, maxX: 0 };
  }
  
  const yPositions = nonRerouteCells.map(cell => cell.canvas.position.y);
  const xPositions = nonRerouteCells.map(cell => cell.canvas.position.x);
  
  return {
    minY: Math.min(...yPositions),
    maxY: Math.max(...yPositions),
    minX: Math.min(...xPositions),
    maxX: Math.max(...xPositions)
  };
};

/**
 * Calculate connection distance for layering
 * @param {Object} fromCell - Source cell
 * @param {Object} toCell - Target cell
 * @returns {number} - Distance between cells
 */
const calculateConnectionDistance = (fromCell, toCell) => {
  const dx = Math.abs(toCell.canvas.position.x - fromCell.canvas.position.x);
  const dy = Math.abs(toCell.canvas.position.y - fromCell.canvas.position.y);
  return Math.sqrt(dx * dx + dy * dy);
};

/**
 * Determine if connection should be above or below flow
 * @param {Object} fromCell - Source cell
 * @param {Object} toCell - Target cell
 * @param {Object} flowBounds - Flow bounds {minY, maxY, minX, maxX}
 * @returns {string} - 'above' or 'below'
 */
const determineReroutePosition = (fromCell, toCell, flowBounds) => {
  const midY = (flowBounds.minY + flowBounds.maxY) / 2;
  const fromY = fromCell.canvas.position.y;
  const toY = toCell.canvas.position.y;
  
  // Calculate average position relative to mid-Y
  const fromOffset = fromY - midY;
  const toOffset = toY - midY;
  const averageOffset = (fromOffset + toOffset) / 2;
  
  // If average is above mid-Y (negative offset), route above
  // If average is below mid-Y (positive offset), route below
  return averageOffset < 0 ? 'above' : 'below';
};

/**
 * Create U-shaped reroute cells with layered positioning
 * @param {string} fromId - Source cell ID
 * @param {string} toId - Target cell ID
 * @param {Object} fromCell - Source cell
 * @param {Object} toCell - Target cell
 * @param {Object} flowBounds - Flow bounds {minY, maxY, minX, maxX}
 * @param {number} layerIndex - Layer index for positioning (0 = closest to flow)
 * @returns {Array} - Array of two reroute cells
 */
const createUShapeReroute = (fromId, toId, fromCell, toCell, flowBounds, layerIndex = 0) => {
  const fromX = fromCell.canvas.position.x;
  const fromY = fromCell.canvas.position.y;
  const toX = toCell.canvas.position.x;
  const toY = toCell.canvas.position.y;
  
  // Calculate U-shape points positioned outside flow bounds
  const midX = (fromX + toX) / 2;
  
  // Determine if reroute should be above or below flow
  const position = determineReroutePosition(fromCell, toCell, flowBounds);
  
  // Calculate layered positioning
  const flowHeight = flowBounds.maxY - flowBounds.minY;
  const baseMargin = Math.max(OVERLAP_CONFIG.uShapeHeight, flowHeight * 0.2);
  const layerSpacing = OVERLAP_CONFIG.uShapeHeight * 0.8; // Spacing between layers
  const totalMargin = baseMargin + (layerIndex * layerSpacing);
  
  let upY;
  if (position === 'above') {
    upY = flowBounds.minY - totalMargin;
  } else {
    upY = flowBounds.maxY + totalMargin;
  }
  
  // Align to grid and shift right by 40px for straight vertical connections
  const gridMidX = Math.round(midX / OVERLAP_CONFIG.gridSize) * OVERLAP_CONFIG.gridSize;
  const gridUpY = Math.round(upY / OVERLAP_CONFIG.gridSize) * OVERLAP_CONFIG.gridSize;
  const shiftedFromX = fromX - 50; // Shift left by 50px
  const shiftedToX = toX - 50; // Shift left by 50px
  
  const reroute1 = {
    type: 24,
    id: `overlap_reroute_${fromId}_${toId}_1`,
    canvas: {
      position: { x: shiftedFromX, y: gridUpY },
      colour: "#4A9EFF"
    },
    properties: { commenttext: "U-Reroute Up" },
    exitPoints: [{
      actionCellId: `overlap_reroute_${fromId}_${toId}_1`,
      order: 0,
      name: "complete",
      connected: `overlap_reroute_${fromId}_${toId}_2`,
      endScript: false,
      key: `overlap_reroute_${fromId}_${toId}_1`,
      properties: [],
      custom: false
    }]
  };

  const reroute2 = {
    type: 24,
    id: `overlap_reroute_${fromId}_${toId}_2`,
    canvas: {
      position: { x: shiftedToX, y: gridUpY },
      colour: "#4A9EFF"
    },
    properties: { commenttext: "U-Reroute Down" },
    exitPoints: [{
      actionCellId: `overlap_reroute_${fromId}_${toId}_2`,
      order: 0,
      name: "complete",
      connected: toId,
      endScript: false,
      key: `overlap_reroute_${fromId}_${toId}_2`,
      properties: [],
      custom: false
    }]
  };

  return [reroute1, reroute2];
};

/**
 * Create N-shaped reroute cells for horizontal connections with layered positioning
 * @param {string} fromId - Source cell ID
 * @param {string} toId - Target cell ID
 * @param {Object} fromCell - Source cell
 * @param {Object} toCell - Target cell
 * @param {Object} flowBounds - Flow bounds {minY, maxY, minX, maxX}
 * @param {number} layerIndex - Layer index for positioning (0 = closest to flow)
 * @returns {Array} - Array of two reroute cells
 */
const createNShapeReroute = (fromId, toId, fromCell, toCell, flowBounds, layerIndex = 0) => {
  const fromX = fromCell.canvas.position.x;
  const fromY = fromCell.canvas.position.y;
  const toX = toCell.canvas.position.x;
  const toY = toCell.canvas.position.y;
  
  // Calculate N-shape points positioned outside flow bounds
  const midX = (fromX + toX) / 2;
  
  // Determine if reroute should be above or below flow
  const position = determineReroutePosition(fromCell, toCell, flowBounds);
  
  // Calculate layered positioning
  const flowHeight = flowBounds.maxY - flowBounds.minY;
  const baseMargin = Math.max(OVERLAP_CONFIG.uShapeHeight, flowHeight * 0.2);
  const layerSpacing = OVERLAP_CONFIG.uShapeHeight * 0.8; // Spacing between layers
  const totalMargin = baseMargin + (layerIndex * layerSpacing);
  
  let upY;
  if (position === 'above') {
    upY = flowBounds.minY - totalMargin;
  } else {
    upY = flowBounds.maxY + totalMargin;
  }
  
  // Align to grid and shift right by 40px for straight vertical connections
  const gridMidX = Math.round(midX / OVERLAP_CONFIG.gridSize) * OVERLAP_CONFIG.gridSize;
  const gridUpY = Math.round(upY / OVERLAP_CONFIG.gridSize) * OVERLAP_CONFIG.gridSize;
  const shiftedFromX = fromX - 50; // Shift left by 50px
  const shiftedToX = toX - 50; // Shift left by 50px
  
  const reroute1 = {
    type: 24,
    id: `overlap_reroute_${fromId}_${toId}_1`,
    canvas: {
      position: { x: shiftedFromX, y: gridUpY },
      colour: "#4A9EFF"
    },
    properties: { commenttext: "N-Reroute Up" },
    exitPoints: [{
      actionCellId: `overlap_reroute_${fromId}_${toId}_1`,
      order: 0,
      name: "complete",
      connected: `overlap_reroute_${fromId}_${toId}_2`,
      endScript: false,
      key: `overlap_reroute_${fromId}_${toId}_1`,
      properties: [],
      custom: false
    }]
  };

  const reroute2 = {
    type: 24,
    id: `overlap_reroute_${fromId}_${toId}_2`,
    canvas: {
      position: { x: shiftedToX, y: gridUpY },
      colour: "#4A9EFF"
    },
    properties: { commenttext: "N-Reroute Down" },
    exitPoints: [{
      actionCellId: `overlap_reroute_${fromId}_${toId}_2`,
      order: 0,
      name: "complete",
      connected: toId,
      endScript: false,
      key: `overlap_reroute_${fromId}_${toId}_2`,
      properties: [],
      custom: false
    }]
  };

  return [reroute1, reroute2];
};

/**
 * Detect overlapping connections
 * @param {Array} cells - Array of positioned cells
 * @param {Array} connections - Array of connections
 * @returns {Array} - Array of overlapping connection pairs
 */
const detectOverlappingConnections = (cells, connections) => {
  const cellMap = new Map();
  cells.forEach(cell => cellMap.set(cell.id, cell));
  
  const overlappingPairs = [];
  
  for (let i = 0; i < connections.length; i++) {
    for (let j = i + 1; j < connections.length; j++) {
      const conn1 = connections[i];
      const conn2 = connections[j];
      
      const fromCell1 = cellMap.get(conn1.from);
      const toCell1 = cellMap.get(conn1.to);
      const fromCell2 = cellMap.get(conn2.from);
      const toCell2 = cellMap.get(conn2.to);
      
      if (!fromCell1 || !toCell1 || !fromCell2 || !toCell2) continue;
      
      // Create line segments
      const line1 = {
        x1: fromCell1.canvas.position.x,
        y1: fromCell1.canvas.position.y,
        x2: toCell1.canvas.position.x,
        y2: toCell1.canvas.position.y
      };
      
      const line2 = {
        x1: fromCell2.canvas.position.x,
        y1: fromCell2.canvas.position.y,
        x2: toCell2.canvas.position.x,
        y2: toCell2.canvas.position.y
      };
      
      if (doLinesOverlap(line1, line2)) {
        overlappingPairs.push({
          conn1,
          conn2,
          fromCell1,
          toCell1,
          fromCell2,
          toCell2
        });
      }
    }
  }
  
  return overlappingPairs;
};

/**
 * Apply overlap optimization to flow data
 * @param {Object} data - Flow data with positioned cells
 * @returns {Object} - Flow data with overlap optimization applied
 */
export const applyOverlapOptimization = (data) => {
  if (!data?.cells) {
    console.error('❌ Invalid data provided to applyOverlapOptimization');
    return data;
  }

  console.log('🔧 Starting overlap optimization for data:', data.scriptName);
  
  try {
    const cells = [...data.cells];
    const connections = [];
    const cellMap = new Map();
    
    // Build cell map and extract connections
    cells.forEach(cell => {
      cellMap.set(cell.id, cell);
    });

    cells.forEach(cell => {
      if (cell.type === 24) return; // Skip reroute cells
      
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

    // Calculate flow bounds for positioning reroute cells
    const flowBounds = calculateFlowBounds(cells);
    console.log(`📐 Flow bounds: minY=${flowBounds.minY}, maxY=${flowBounds.maxY}, minX=${flowBounds.minX}, maxX=${flowBounds.maxX}`);

    // Detect overlapping connections
    const overlappingPairs = detectOverlappingConnections(cells, connections);
    console.log(`🔍 Found ${overlappingPairs.length} overlapping connection pairs`);

    // Collect all connections that need rerouting
    const connectionsToReroute = [];
    const processedConnections = new Set();

    overlappingPairs.forEach(({ conn1, conn2, fromCell1, toCell1, fromCell2, toCell2 }) => {
      // Prioritize right-to-left connections for rerouting
      const shouldReroute1 = isRightToLeftConnection(fromCell1, toCell1) && 
                           isLongEnoughForRerouting(fromCell1, toCell1) &&
                           !processedConnections.has(`${conn1.from}-${conn1.to}`);
      
      const shouldReroute2 = isRightToLeftConnection(fromCell2, toCell2) && 
                           isLongEnoughForRerouting(fromCell2, toCell2) &&
                           !processedConnections.has(`${conn2.from}-${conn2.to}`);

      if (shouldReroute1) {
        const distance = calculateConnectionDistance(fromCell1, toCell1);
        connectionsToReroute.push({
          conn: conn1,
          fromCell: fromCell1,
          toCell: toCell1,
          distance
        });
        processedConnections.add(`${conn1.from}-${conn1.to}`);
      }

      if (shouldReroute2) {
        const distance = calculateConnectionDistance(fromCell2, toCell2);
        connectionsToReroute.push({
          conn: conn2,
          fromCell: fromCell2,
          toCell: toCell2,
          distance
        });
        processedConnections.add(`${conn2.from}-${conn2.to}`);
      }
    });

    // Sort connections by distance (shortest first = closest to flow)
    connectionsToReroute.sort((a, b) => a.distance - b.distance);
    console.log(`🔄 Processing ${connectionsToReroute.length} connections for rerouting, sorted by distance`);

    const finalCells = [...cells];

    // Process connections with layered positioning
    connectionsToReroute.forEach(({ conn, fromCell, toCell, distance }, index) => {
      // Create U/N-shaped reroute with layer index
      const rerouteCells = createUShapeReroute(conn.from, conn.to, fromCell, toCell, flowBounds, index);
      
      // Update connection to use first reroute
      const fromCellIndex = finalCells.findIndex(c => c.id === conn.from);
      if (fromCellIndex !== -1) {
        finalCells[fromCellIndex] = {
          ...finalCells[fromCellIndex],
          exitPoints: finalCells[fromCellIndex].exitPoints.map(ep => 
            ep.connected === conn.to ? { ...ep, connected: rerouteCells[0].id } : ep
          )
        };
      }
      
      finalCells.push(...rerouteCells);
      console.log(`🔄 Applied layered U-shape rerouting for connection ${conn.from} -> ${conn.to} (layer ${index}, distance ${distance.toFixed(0)})`);
    });
    
    console.log('✅ Overlap optimization complete!');
    console.log('📊 Final cell count:', finalCells.length);
    console.log('🔀 Reroute cells added:', finalCells.filter(cell => cell.type === 24).length);
    
    return { ...data, cells: finalCells };
  } catch (error) {
    console.error('❌ Error in applyOverlapOptimization:', error);
    return data;
  }
};
