// Overlap Optimization Module
// Detects overlapping connections and applies U/N-shaped rerouting to minimize overlaps

// Constants for overlap optimization
const OVERLAP_CONFIG = {
  minOverlapDistance: 20, // Minimum distance to consider as overlap
  minConnectionLength: 100, // Minimum connection length to consider for rerouting
  uShapeHeight: 150, // Base height for U-shape reroutes
  gridSize: 50 // Grid alignment for reroute cells
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
  
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    // Intersection point exists within both segments
    // Check if the intersection is "significant" (not just touching endpoints)
    const intersectX = x1 + t * (x2 - x1);
    const intersectY = y1 + t * (y2 - y1);

    // Check if intersection is close to either endpoint of line1
    const dist1_ep1 = Math.sqrt(Math.pow(intersectX - x1, 2) + Math.pow(intersectY - y1, 2));
    const dist1_ep2 = Math.sqrt(Math.pow(intersectX - x2, 2) + Math.pow(intersectY - y2, 2));
    
    // Check if intersection is close to either endpoint of line2
    const dist2_ep1 = Math.sqrt(Math.pow(intersectX - x3, 2) + Math.pow(intersectY - y3, 2));
    const dist2_ep2 = Math.sqrt(Math.pow(intersectX - x4, 2) + Math.pow(intersectY - y4, 2));

    const minEndpointDistance = 10; // Threshold to consider it a non-endpoint overlap
    
    if (dist1_ep1 > minEndpointDistance && dist1_ep2 > minEndpointDistance &&
        dist2_ep1 > minEndpointDistance && dist2_ep2 > minEndpointDistance) {
      return true;
    }
  }
  return false;
};

/**
 * Detect overlapping connections
 * @param {Array} cells - Array of flow cells
 * @param {Array} connections - Array of connection objects
 * @returns {Array} - Array of overlapping connection pairs
 */
const detectOverlappingConnections = (cells, connections) => {
  const overlappingPairs = [];
  const cellMap = new Map(cells.map(cell => [cell.id, cell]));

  for (let i = 0; i < connections.length; i++) {
    for (let j = i + 1; j < connections.length; j++) {
      const conn1 = connections[i];
      const conn2 = connections[j];

      const fromCell1 = cellMap.get(conn1.from);
      const toCell1 = cellMap.get(conn1.to);
      const fromCell2 = cellMap.get(conn2.from);
      const toCell2 = cellMap.get(conn2.to);

      if (!fromCell1 || !toCell1 || !fromCell2 || !toCell2) continue;

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
          conn1, conn2,
          fromCell1, toCell1,
          fromCell2, toCell2
        });
      }
    }
  }
  return overlappingPairs;
};

/**
 * Check if a connection is primarily right-to-left
 * @param {Object} fromCell - Source cell
 * @param {Object} toCell - Target cell
 * @returns {boolean} - True if right-to-left
 */
const isRightToLeftConnection = (fromCell, toCell) => {
  return fromCell.canvas.position.x > toCell.canvas.position.x;
};

/**
 * Check if a connection is long enough for rerouting
 * @param {Object} fromCell - Source cell
 * @param {Object} toCell - Target cell
 * @returns {boolean} - True if long enough
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
 * Get the next available numeric ID for reroute cells
 * @param {Array} cells - Array of existing cells
 * @returns {number} - Next available ID
 */
const getNextRerouteId = (cells) => {
  const existingIds = cells.map(cell => cell.id).filter(id => typeof id === 'number');
  return existingIds.length > 0 ? Math.max(...existingIds) + 1 : 10000;
};

/**
 * Generate a UUID-style key for exit points
 * @returns {string} - UUID-style key
 */
const generateKey = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * Create U-shaped reroute cells with layered positioning
 * @param {number} fromId - Source cell ID
 * @param {number} toId - Target cell ID
 * @param {Object} fromCell - Source cell
 * @param {Object} toCell - Target cell
 * @param {Object} flowBounds - Flow bounds {minY, maxY, minX, maxX}
 * @param {number} layerIndex - Layer index for positioning (0 = closest to flow)
 * @param {number} nextRerouteId - Next available numeric ID for reroute cells
 * @returns {Array} - Array of two reroute cells
 */
const createUShapeReroute = (fromId, toId, fromCell, toCell, flowBounds, layerIndex = 0, nextRerouteId) => {
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
  
  // Align to grid and shift left by 50px for straight vertical connections
  const gridMidX = Math.round(midX / OVERLAP_CONFIG.gridSize) * OVERLAP_CONFIG.gridSize;
  const gridUpY = Math.round(upY / OVERLAP_CONFIG.gridSize) * OVERLAP_CONFIG.gridSize;
  const shiftedFromX = fromX - 50; // Shift left by 50px
  const shiftedToX = toX - 50; // Shift left by 50px
  
  const reroute1Id = nextRerouteId;
  const reroute2Id = nextRerouteId + 1;
  
      const reroute1 = {
        allowAllRoutes: true,
        type: 24,
        id: reroute1Id,
        canvas: {
          position: { x: shiftedFromX, y: gridUpY },
          colour: "#4A9EFF",
          customName: "reroute",
          properties: {},
          id: reroute1Id
        },
        properties: { commenttext: "U-Reroute Up" },
        exitPoints: [
          {
            actionCellId: reroute1Id,
            order: 0,
            name: "complete",
            connected: reroute2Id,
            endScript: false,
            key: generateKey(),
            properties: [],
            custom: false
          },
          {
            actionCellId: reroute1Id,
            order: 1,
            name: "error",
            connected: reroute2Id,
            endScript: false,
            key: generateKey(),
            properties: [],
            custom: false
          }
        ],
        version: 2
      };

      const reroute2 = {
        allowAllRoutes: true,
        type: 24,
        id: reroute2Id,
        canvas: {
          position: { x: shiftedToX, y: gridUpY },
          colour: "#4A9EFF",
          customName: "reroute",
          properties: {},
          id: reroute2Id
        },
        properties: { commenttext: "U-Reroute Down" },
        exitPoints: [
          {
            actionCellId: reroute2Id,
            order: 0,
            name: "complete",
            connected: toId,
            endScript: false,
            key: generateKey(),
            properties: [],
            custom: false
          },
          {
            actionCellId: reroute2Id,
            order: 1,
            name: "error",
            connected: toId,
            endScript: false,
            key: generateKey(),
            properties: [],
            custom: false
          }
        ],
        version: 2
      };

  return [reroute1, reroute2];
};

/**
 * Create N-shaped reroute cells for horizontal connections with layered positioning
 * @param {number} fromId - Source cell ID
 * @param {number} toId - Target cell ID
 * @param {Object} fromCell - Source cell
 * @param {Object} toCell - Target cell
 * @param {Object} flowBounds - Flow bounds {minY, maxY, minX, maxX}
 * @param {number} layerIndex - Layer index for positioning (0 = closest to flow)
 * @param {number} nextRerouteId - Next available numeric ID for reroute cells
 * @returns {Array} - Array of two reroute cells
 */
const createNShapeReroute = (fromId, toId, fromCell, toCell, flowBounds, layerIndex = 0, nextRerouteId) => {
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
  
  // Align to grid and shift left by 50px for straight vertical connections
  const gridMidX = Math.round(midX / OVERLAP_CONFIG.gridSize) * OVERLAP_CONFIG.gridSize;
  const gridUpY = Math.round(upY / OVERLAP_CONFIG.gridSize) * OVERLAP_CONFIG.gridSize;
  const shiftedFromX = fromX - 50; // Shift left by 50px
  const shiftedToX = toX - 50; // Shift left by 50px
  
  const reroute1Id = nextRerouteId;
  const reroute2Id = nextRerouteId + 1;
  
  const reroute1 = {
    allowAllRoutes: true,
    type: 24,
    id: reroute1Id,
    canvas: {
      position: { x: shiftedFromX, y: gridUpY },
      colour: "#4A9EFF",
      customName: "reroute",
      properties: {},
      id: reroute1Id
    },
    properties: { commenttext: "N-Reroute Up" },
    exitPoints: [
      {
        actionCellId: reroute1Id,
        order: 0,
        name: "complete",
        connected: reroute2Id,
        endScript: false,
        key: generateKey(),
        properties: [],
        custom: false
      },
      {
        actionCellId: reroute1Id,
        order: 1,
        name: "error",
        connected: reroute2Id,
        endScript: false,
        key: generateKey(),
        properties: [],
        custom: false
      }
    ],
    version: 2
  };

  const reroute2 = {
    allowAllRoutes: true,
    type: 24,
    id: reroute2Id,
    canvas: {
      position: { x: shiftedToX, y: gridUpY },
      colour: "#4A9EFF",
      customName: "reroute",
      properties: {},
      id: reroute2Id
    },
    properties: { commenttext: "N-Reroute Down" },
    exitPoints: [
      {
        actionCellId: reroute2Id,
        order: 0,
        name: "complete",
        connected: toId,
        endScript: false,
        key: generateKey(),
        properties: [],
        custom: false
      },
      {
        actionCellId: reroute2Id,
        order: 1,
        name: "error",
        connected: toId,
        endScript: false,
        key: generateKey(),
        properties: [],
        custom: false
      }
    ],
    version: 2
  };

  return [reroute1, reroute2];
};

/**
 * Apply overlap optimization to flow data
 * @param {Object} data - The flow data object
 * @returns {Object} - Flow data with overlap optimization applied
 */
export const applyOverlapOptimization = (data) => {
  if (!data?.cells) {
    console.error('❌ Invalid data provided to applyOverlapOptimization');
    return data;
  }

  console.log('🔧 Starting overlap optimization for data:', data.scriptName);
  
  const cells = [...data.cells]; // Create a mutable copy
  const connections = [];
  const cellMap = new Map(cells.map(cell => [cell.id, cell]));

  // Rebuild connections from current cells (including any reroutes from previous steps)
  cells.forEach(cell => {
    if (cell.exitPoints) {
      cell.exitPoints.forEach(exitPoint => {
        if (exitPoint.connected !== null && exitPoint.connected !== undefined) {
          connections.push({
            from: cell.id,
            to: exitPoint.connected,
            name: exitPoint.name,
            exitPoint: exitPoint // Keep reference to the exit point for updating
          });
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
  let nextRerouteId = getNextRerouteId(cells);

  // Process connections with layered positioning
  connectionsToReroute.forEach(({ conn, fromCell, toCell, distance }, index) => {
    // Create U/N-shaped reroute with layer index
    const rerouteCells = createUShapeReroute(conn.from, conn.to, fromCell, toCell, flowBounds, index, nextRerouteId);
    
    // Update the original connection to use first reroute
    const fromCellIndex = finalCells.findIndex(c => c.id === conn.from);
    if (fromCellIndex !== -1) {
      // Find the specific exit point that connects to the target
      const exitPointIndex = finalCells[fromCellIndex].exitPoints.findIndex(ep => 
        ep.connected === conn.to && ep.actionCellId === conn.from
      );
      
      if (exitPointIndex !== -1) {
        // Update the exit point to connect to the first reroute cell
        finalCells[fromCellIndex].exitPoints[exitPointIndex] = {
          ...finalCells[fromCellIndex].exitPoints[exitPointIndex],
          connected: rerouteCells[0].id
        };
        
        console.log(`🔗 Updated connection: ${conn.from} -> ${rerouteCells[0].id} (was ${conn.to})`);
      } else {
        console.warn(`⚠️ Could not find exit point for connection ${conn.from} -> ${conn.to}`);
      }
    } else {
      console.warn(`⚠️ Could not find source cell ${conn.from}`);
    }
    
    finalCells.push(...rerouteCells);
    nextRerouteId += 2; // Increment for next pair of reroute cells
    console.log(`🔄 Applied layered U-shape rerouting for connection ${conn.from} -> ${conn.to} (layer ${index}, distance ${distance.toFixed(0)})`);
  });
  
  // Update the links array to include reroute connections
  const updatedLinks = [...(data.links || [])];
  
  // Add new links for reroute cells
  connectionsToReroute.forEach(({ conn, fromCell, toCell, distance }, index) => {
    const reroute1Id = getNextRerouteId(cells) + (index * 2);
    const reroute2Id = reroute1Id + 1;
    
    // Remove original link
    const originalLinkIndex = updatedLinks.findIndex(link => 
      link.from === conn.from && link.to === conn.to
    );
    if (originalLinkIndex !== -1) {
      updatedLinks.splice(originalLinkIndex, 1);
    }
    
    // Add new links: from -> reroute1 -> reroute2 -> to
    updatedLinks.push(
      { from: conn.from, to: reroute1Id },
      { from: reroute1Id, to: reroute2Id },
      { from: reroute2Id, to: conn.to }
    );
    
    console.log(`🔗 Updated links: ${conn.from} -> ${reroute1Id} -> ${reroute2Id} -> ${conn.to}`);
  });

  // Validate connections after rerouting
  console.log('🔍 Validating connections after rerouting...');
  const rerouteCells = finalCells.filter(cell => cell.type === 24);
  rerouteCells.forEach(reroute => {
    const connections = finalCells.filter(cell => 
      cell.exitPoints && cell.exitPoints.some(ep => ep.connected === reroute.id)
    );
    console.log(`🔗 Reroute ${reroute.id} is connected from:`, connections.map(c => c.id));
  });
  
  console.log('✅ Overlap optimization complete!');
  console.log('📊 Final cell count:', finalCells.length);
  console.log('🔀 Reroute cells added:', rerouteCells.length);
  console.log('🔗 Links updated:', updatedLinks.length);
  
  return { 
    ...data, 
    cells: finalCells,
    links: updatedLinks
  };
};