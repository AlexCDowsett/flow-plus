import React, { useState, useEffect, useRef } from 'react';
import './App.css';

// Constants
const FILE_OPTIONS = [
  { value: 'wheatley', label: 'Wheatley POC ID' },
  { value: 'ald', label: 'ALD A5' },
  { value: 'efr', label: 'EFR-SVCC Email Test' }
];

const OPTIMIZATION_METHODS = [
  { value: 'Original', label: 'Original Layout' },
  { value: 'Optimized', label: 'Optimized Layout' }
];

const DEFAULT_TYPE_NAMES = {
  '-1': 'Start',
  '1': 'Play Prompt',
  '3': 'Data Entry',
  '11': 'Decision',
  '12': 'Assign Variable',
  '15': 'Comment',
  '24': 'Reroute'
};

const LAYOUT_CONFIG = {
  cellSpacing: 250,
  levelSpacing: 200,
  startX: 100,
  startY: 200,
  minFontSize: 8,
  baseFontSize: 10,
  textOffset: 20
};

// Utility functions
const isLightBackground = (color) => {
  if (color.startsWith('#')) {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5;
  }
  
  if (color.startsWith('rgb')) {
    const matches = color.match(/\d+/g);
    if (matches && matches.length >= 3) {
      const r = parseInt(matches[0]);
      const g = parseInt(matches[1]);
      const b = parseInt(matches[2]);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.5;
    }
  }
  
  return false;
};

const getCellName = (cell, typeNames) => {
  if (cell.canvas.customName) {
    return cell.canvas.customName;
  }

  const typeName = typeNames[cell.type.toString()] || `Type ${cell.type}`;
  
  if (cell.properties) {
    if (cell.properties.prompt) {
      return `${typeName}: ${cell.properties.prompt}`;
    }
    if (cell.properties.tableid) {
      return `${typeName}: ${cell.properties.tableid}`;
    }
    if (cell.properties.destinationvariable) {
      return `${typeName}: ${cell.properties.destinationvariable}`;
    }
  }

  return typeName;
};

// Main App Component
function App() {
  // State
  const [selectedFile, setSelectedFile] = useState('');
  const [flowData, setFlowData] = useState(null);
  const [selectedMethod, setSelectedMethod] = useState('Original');
  const [optimizedFlowData, setOptimizedFlowData] = useState(null);
  const [typeNames, setTypeNames] = useState({});
  
  // View state
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // UI controls
  const [smoothing, setSmoothing] = useState(50);
  const [circleSize, setCircleSize] = useState(35);
  const [connectionCircleSize, setConnectionCircleSize] = useState(6);
  
  const svgRef = useRef(null);

  // Effects
  useEffect(() => {
    loadTypeNames();
  }, []);

  useEffect(() => {
    if (selectedFile) {
      loadFlowData(selectedFile);
    }
  }, [selectedFile]);

  useEffect(() => {
    if (flowData && selectedMethod) {
      if (selectedMethod === 'Original') {
        calculateViewport(flowData);
      } else if (selectedMethod === 'Optimized' && optimizedFlowData) {
        calculateViewport(optimizedFlowData);
      }
    }
  }, [selectedMethod, flowData, optimizedFlowData]);

  // Data loading functions
  const loadTypeNames = async () => {
    try {
      const response = await fetch('/type-names.json');
      const data = await response.json();
      setTypeNames(data.typeNames || DEFAULT_TYPE_NAMES);
    } catch (error) {
      console.error('Error loading type names:', error);
      setTypeNames(DEFAULT_TYPE_NAMES);
    }
  };

  const loadFlowData = async (fileType) => {
    try {
      const fileName = getFileName(fileType);
      if (!fileName) return;

      const response = await fetch(`/${fileName}`);
      const data = await response.json();
      setFlowData(data);
      
      // Create optimized layout
      try {
        const optimized = createOptimizedLayout(data);
        setOptimizedFlowData(optimized);
        console.log('✅ Optimized layout created successfully');
      } catch (error) {
        console.error('❌ Failed to create optimized layout:', error);
        setOptimizedFlowData(null);
      }
      
      // Apply selected method
      applySelectedMethod(data);
    } catch (error) {
      console.error('Error loading flow data:', error);
    }
  };

  const getFileName = (fileType) => {
    const fileMap = {
      'wheatley': 'wheatley POC ID_revision20.json',
      'ald': 'ald_a_5_revision4.json',
      'efr': 'EFR-SVCC Email Test_revision8.json'
    };
    return fileMap[fileType];
  };

  const applySelectedMethod = (data) => {
    if (selectedMethod === 'Original') {
      calculateViewport(data);
    } else if (selectedMethod === 'Optimized' && optimizedFlowData) {
      calculateViewport(optimizedFlowData);
    } else {
      calculateViewport(data);
    }
  };

  // Viewport calculation
  const calculateViewport = (data) => {
    if (!data?.cells?.length) return;

    const positions = data.cells.map(cell => ({
      x: cell.canvas.position.x,
      y: cell.canvas.position.y
    }));

    const minX = Math.min(...positions.map(p => p.x));
    const maxX = Math.max(...positions.map(p => p.x));
    const minY = Math.min(...positions.map(p => p.y));
    const maxY = Math.max(...positions.map(p => p.y));

    const width = maxX - minX;
    const height = maxY - minY;

    const padding = 100;
    const viewportWidth = window.innerWidth - padding;
    const viewportHeight = window.innerHeight - padding;

    const scaleX = viewportWidth / width;
    const scaleY = viewportHeight / height;
    const scale = Math.min(scaleX, scaleY, 1);

    setZoom(scale);
    setOffset({
      x: (viewportWidth - width * scale) / 2 - minX * scale,
      y: (viewportHeight - height * scale) / 2 - minY * scale
    });
  };

  // Layout optimization
  const createOptimizedLayout = (data) => {
    if (!data?.cells) {
      console.error('❌ Invalid data provided to createOptimizedLayout');
      return null;
    }

    try {
      console.log('🔧 Starting optimization for data:', data.scriptName);
      console.log('📊 Total cells:', data.cells.length);

      const { filteredCells, connections } = processCells(data);
      const { levels, levelGroups } = assignLevels(filteredCells, connections);
      const optimizedCells = positionCells(filteredCells, levels, levelGroups);
      const finalCells = addRoutingCells(optimizedCells, connections, levels);

      console.log('✅ Optimization complete!');
      console.log('📊 Final cell count:', finalCells.length);
      console.log('🔀 Type 24 cells added:', finalCells.filter(cell => cell.type === 24).length);

      return { ...data, cells: finalCells };
    } catch (error) {
      console.error('❌ Error in createOptimizedLayout:', error);
      return data;
    }
  };

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

  const assignLevels = (filteredCells, connections) => {
    const adjacencyList = new Map();
    const inDegree = new Map();
    
    filteredCells.forEach(cell => {
      adjacencyList.set(cell.id, []);
      inDegree.set(cell.id, 0);
    });

    connections.forEach(conn => {
      if (adjacencyList.has(conn.from) && adjacencyList.has(conn.to)) {
        adjacencyList.get(conn.from).push(conn.to);
        inDegree.set(conn.to, inDegree.get(conn.to) + 1);
      }
    });

    const startNodes = filteredCells.filter(cell => inDegree.get(cell.id) === 0);
    const startNode = startNodes.find(cell => cell.type === -1) || startNodes[0];
    
    console.log('🚀 Start nodes found:', startNodes.length);
    console.log('🎯 Selected start node:', startNode ? `ID: ${startNode.id}, Type: ${startNode.type}` : 'None');

    const levels = new Map();
    const queue = [{ cell: startNode, level: 0 }];
    const visited = new Set();

    while (queue.length > 0) {
      const { cell, level } = queue.shift();
      
      if (visited.has(cell.id)) continue;
      visited.add(cell.id);
      
      levels.set(cell.id, level);
      
      const connectedCells = adjacencyList.get(cell.id) || [];
      connectedCells.forEach(connectedId => {
        if (!visited.has(connectedId)) {
          const connectedCell = filteredCells.find(c => c.id === connectedId);
          if (connectedCell) {
            queue.push({ cell: connectedCell, level: level + 1 });
          }
        }
      });
    }

    filteredCells.forEach(cell => {
      if (!visited.has(cell.id)) {
        levels.set(cell.id, 0);
      }
    });

    const levelGroups = new Map();
    levels.forEach((level, cellId) => {
      if (!levelGroups.has(level)) {
        levelGroups.set(level, []);
      }
      levelGroups.get(level).push(cellId);
    });

    console.log('📈 Cells processed:', visited.size);
    console.log('📊 Level distribution:', Array.from(levels.values()).reduce((acc, level) => {
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    }, {}));

    return { levels, levelGroups };
  };

  const positionCells = (filteredCells, levels, levelGroups) => {
    return filteredCells.map(cell => {
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

  const addRoutingCells = (optimizedCells, connections, levels) => {
    const finalCells = [...optimizedCells];
    
    connections.forEach(conn => {
      const fromCell = optimizedCells.find(c => c.id === conn.from);
      const toCell = optimizedCells.find(c => c.id === conn.to);
      
      if (fromCell && toCell && fromCell.canvas && toCell.canvas && 
          fromCell.canvas.position && toCell.canvas.position) {
        const fromLevel = levels.get(conn.from) || 0;
        const toLevel = levels.get(conn.to) || 0;
        
        const levelDiff = toLevel - fromLevel;
        const verticalDiff = Math.abs(fromCell.canvas.position.y - toCell.canvas.position.y);
        
        if (levelDiff > 1 && verticalDiff > 300) {
          const type24Cell = createType24Cell(conn.from, conn.to, fromCell, toCell);
          
          const fromCellIndex = finalCells.findIndex(c => c.id === conn.from);
          if (fromCellIndex !== -1) {
            finalCells[fromCellIndex] = {
              ...finalCells[fromCellIndex],
              exitPoints: finalCells[fromCellIndex].exitPoints.map(ep => 
                ep.connected === conn.to ? { ...ep, connected: type24Cell.id } : ep
              )
            };
          }
          
          finalCells.push(type24Cell);
        }
      }
    });

    return finalCells;
  };

  const createType24Cell = (fromId, toId, fromCell, toCell) => {
    return {
      type: 24,
      id: `routing_${fromId}_${toId}`,
      canvas: {
        position: {
          x: fromCell.canvas.position.x + (toCell.canvas.position.x - fromCell.canvas.position.x) * 0.5,
          y: fromCell.canvas.position.y + (toCell.canvas.position.y - fromCell.canvas.position.y) * 0.5
        },
        colour: "#4A9EFF"
      },
      properties: { commenttext: "" },
      exitPoints: [{
        actionCellId: `routing_${fromId}_${toId}`,
        order: 0,
        name: "complete",
        connected: toId,
        endScript: false,
        key: `routing_${fromId}_${toId}`,
        properties: [],
        custom: false
      }]
    };
  };

  // Mouse event handlers
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(5, zoom * delta));
    
    const rect = svgRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const worldX = (centerX - offset.x) / zoom;
    const worldY = (centerY - offset.y) / zoom;
    
    setZoom(newZoom);
    setOffset({
      x: centerX - worldX * newZoom,
      y: centerY - worldY * newZoom
    });
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Rendering functions
  const getCurrentData = () => {
    return selectedMethod === 'Original' ? flowData : optimizedFlowData;
  };

  const renderConnections = () => {
    const currentData = getCurrentData();
    if (!currentData) return null;

    const connections = [];
    const cellMap = new Map();
    
    currentData.cells.forEach(cell => {
      cellMap.set(cell.id, cell);
    });

    currentData.cells.forEach(cell => {
      if (cell.exitPoints) {
        cell.exitPoints.forEach(exitPoint => {
          if (exitPoint.connected !== null && exitPoint.connected !== undefined) {
            const targetCell = cellMap.get(exitPoint.connected);
            if (targetCell) {
              connections.push({
                from: cell,
                to: targetCell,
                name: exitPoint.name
              });
            }
          }
        });
      }
    });

    return connections.map((connection, index) => {
      const fromCellX = connection.from.canvas.position.x * zoom + offset.x;
      const fromCellY = connection.from.canvas.position.y * zoom + offset.y;
      const toCellX = connection.to.canvas.position.x * zoom + offset.x;
      const toCellY = connection.to.canvas.position.y * zoom + offset.y;
      
      const fromX = fromCellX + (circleSize * zoom) + (connectionCircleSize * zoom);
      const fromY = fromCellY;
      const toX = toCellX - (circleSize * zoom) - (connectionCircleSize * zoom);
      const toY = toCellY;

      const connDx = toX - fromX;
      const connDy = toY - fromY;
      const connDistance = Math.sqrt(connDx * connDx + connDy * connDy);

      const tension = smoothing / 200;
      const tangentLength = Math.max(connDistance * 0.4, 60) * (1 + tension);
      
      const startTangentX = tangentLength;
      const startTangentY = 0;
      const endTangentX = -tangentLength;
      const endTangentY = 0;
      
      const cp1X = fromX + startTangentX / 3;
      const cp1Y = fromY + startTangentY / 3;
      const cp2X = toX + endTangentX / 3;
      const cp2Y = toY + endTangentY / 3;

      const midT = 0.5;
      const midX = Math.pow(1-midT, 3) * fromX + 3 * Math.pow(1-midT, 2) * midT * cp1X + 3 * (1-midT) * Math.pow(midT, 2) * cp2X + Math.pow(midT, 3) * toX;
      const midY = Math.pow(1-midT, 3) * fromY + 3 * Math.pow(1-midT, 2) * midT * cp1Y + 3 * (1-midT) * Math.pow(midT, 2) * cp2Y + Math.pow(midT, 3) * toY;

      const tangentX = 3 * Math.pow(1-midT, 2) * (cp1X - fromX) + 6 * (1-midT) * midT * (cp2X - cp1X) + 3 * Math.pow(midT, 2) * (toX - cp2X);
      const tangentY = 3 * Math.pow(1-midT, 2) * (cp1Y - fromY) + 6 * (1-midT) * midT * (cp2Y - cp1Y) + 3 * Math.pow(midT, 2) * (toY - cp2Y);
      const arrowAngle = Math.atan2(tangentY, tangentX) * 180 / Math.PI;

      return (
        <g key={index}>
          <path
            d={`M ${fromX} ${fromY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${toX} ${toY}`}
            stroke="#4A9EFF"
            strokeWidth="2"
            fill="none"
          />
          
          <g transform={`translate(${midX}, ${midY}) rotate(${arrowAngle})`}>
            <polygon
              points={`0,0 ${8 * zoom},${3 * zoom} 0,${6 * zoom}`}
              fill="#4A9EFF"
              transform={`translate(0, ${-3 * zoom})`}
            />
          </g>
          
          <circle
            cx={fromX}
            cy={fromY}
            r={connectionCircleSize * zoom}
            fill="none"
            stroke="#4A9EFF"
            strokeWidth="2"
          />
          
          <circle
            cx={toX}
            cy={toY}
            r={connectionCircleSize * zoom}
            fill="#4A9EFF"
            stroke="#4A9EFF"
            strokeWidth="1"
          />
        </g>
      );
    });
  };

  const renderCells = () => {
    const currentData = getCurrentData();
    if (!currentData) return null;

    return currentData.cells.map(cell => {
      const x = cell.canvas.position.x * zoom + offset.x;
      const y = cell.canvas.position.y * zoom + offset.y;
      const radius = circleSize * zoom;

      let cellColor = cell.canvas.colour || "#2D3748";
      if (cell.type === 24) {
        cellColor = "#4A9EFF";
      }

      const cellName = getCellName(cell, typeNames);
      const textY = y + radius + (LAYOUT_CONFIG.textOffset * zoom);
      const fontSize = Math.max(LAYOUT_CONFIG.minFontSize, LAYOUT_CONFIG.baseFontSize * zoom);

      return (
        <g key={cell.id}>
          <circle
            cx={x}
            cy={y}
            r={radius}
            fill={cellColor}
            stroke="#E2E8F0"
            strokeWidth="2"
          />
          <text
            x={x}
            y={textY}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={fontSize}
            fontWeight="bold"
            fill="#FFFFFF"
          >
            {cellName.length > 15 ? cellName.substring(0, 15) + '...' : cellName}
          </text>
        </g>
      );
    });
  };

  // Render
  return (
    <div className="App">
      <header className="App-header">
        <h1>Flow Chart Visualizer</h1>
        <div className="controls">
          <select 
            value={selectedFile} 
            onChange={(e) => setSelectedFile(e.target.value)}
          >
            <option value="">Select a flow chart</option>
            {FILE_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          
          <div className="control-group">
            <label htmlFor="smoothing-slider">Smoothing:</label>
            <input
              id="smoothing-slider"
              type="range"
              min="0"
              max="200"
              value={smoothing}
              onChange={(e) => setSmoothing(parseInt(e.target.value))}
              className="smoothing-slider"
            />
            <span className="smoothing-value">{smoothing}px</span>
          </div>
          
          <div className="control-group">
            <label htmlFor="circle-size-slider">Flow Cell Size:</label>
            <input
              id="circle-size-slider"
              type="range"
              min="10"
              max="50"
              value={circleSize}
              onChange={(e) => setCircleSize(parseInt(e.target.value))}
              className="smoothing-slider"
            />
            <span className="smoothing-value">{circleSize}px</span>
          </div>
          
          <div className="control-group">
            <label htmlFor="connection-circle-size-slider">Connection Circle Size:</label>
            <input
              id="connection-circle-size-slider"
              type="range"
              min="2"
              max="12"
              value={connectionCircleSize}
              onChange={(e) => setConnectionCircleSize(parseInt(e.target.value))}
              className="smoothing-slider"
            />
            <span className="smoothing-value">{connectionCircleSize}px</span>
          </div>
          
          <div className="control-group">
            <label htmlFor="method-select">Layout Method:</label>
            <select
              id="method-select"
              value={selectedMethod}
              onChange={(e) => setSelectedMethod(e.target.value)}
              className="method-select"
            >
              {OPTIMIZATION_METHODS.map((method, index) => (
                <option key={index} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
          </div>
          
          <div className="zoom-info">
            Zoom: {Math.round(zoom * 100)}% | Drag to pan
          </div>
        </div>
      </header>
      
      <main className="visualization-container">
        {(flowData || optimizedFlowData) && (
          <svg
            ref={svgRef}
            width="100%"
            height="calc(100vh - 120px)"
            style={{ background: '#1A202C', cursor: isDragging ? 'grabbing' : 'grab' }}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <defs></defs>
            {renderConnections()}
            {renderCells()}
          </svg>
        )}
      </main>
    </div>
  );
}

export default App;