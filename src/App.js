import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { getLayoutMethods, applyLayoutMethod } from './layoutOptimization';
import { applyOverlapOptimization } from './optimization/overlapOptimization';

// Import layout config for rendering
const LAYOUT_CONFIG = {
  cellSpacing: 250,
  levelSpacing: 200,
  startX: 100,
  startY: 200,
  minFontSize: 8,
  baseFontSize: 10,
  textOffset: 20
};

// Constants
const FILE_OPTIONS = [
  { value: 'wheatley', label: 'Wheatley POC ID' },
  { value: 'ald', label: 'ALD A5' },
  { value: 'efr', label: 'EFR-SVCC Email Test' }
];

// Get optimization methods dynamically
const OPTIMIZATION_METHODS = getLayoutMethods();

const DEFAULT_TYPE_NAMES = {
  '-1': 'Start',
  '1': 'Play Prompt',
  '3': 'Data Entry',
  '11': 'Decision',
  '12': 'Assign Variable',
  '15': 'Comment'
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
  const [selectedMethod, setSelectedMethod] = useState('original');
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
  const [enableOverlapOptimization, setEnableOverlapOptimization] = useState(false);
  
  const svgRef = useRef(null);

  // Effects
  useEffect(() => {
    loadTypeNames();
  }, []);

  // Handle window resize to recalculate viewport
  useEffect(() => {
    const handleResize = () => {
      const currentData = getCurrentData();
      if (currentData) {
        calculateViewport(currentData);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [selectedMethod, flowData, optimizedFlowData]);

  // Initial centering when component mounts
  useEffect(() => {
    const currentData = getCurrentData();
    if (currentData) {
      // Delay to ensure DOM is fully rendered
      setTimeout(() => {
        calculateViewport(currentData);
      }, 100);
    }
  }, [flowData, optimizedFlowData]);

  useEffect(() => {
    if (selectedFile) {
      loadFlowData(selectedFile);
    }
  }, [selectedFile]);

  useEffect(() => {
    if (flowData && selectedMethod) {
      console.log(`🔄 Layout method changed to: ${selectedMethod}`);
      
      // Clear previous optimized data to prevent persistence
      setOptimizedFlowData(null);
      console.log('🧹 Cleared previous optimized data');
      
      // Small delay to ensure clearing is processed before applying new layout
      setTimeout(() => {
        if (selectedMethod === 'original') {
          const type24Count = flowData.cells ? flowData.cells.filter(cell => cell.type === 24).length : 0;
          console.log(`📊 Original data - type24Count: ${type24Count}, totalCells: ${flowData.cells ? flowData.cells.length : 0}`);
          calculateViewport(flowData);
        } else {
          // Apply the selected layout method to the original data
          try {
            let optimizedData = applyLayoutMethod(flowData, selectedMethod);
            
            // Apply overlap optimization if enabled
            if (enableOverlapOptimization) {
              console.log('🔧 Applying overlap optimization...');
              optimizedData = applyOverlapOptimization(optimizedData);
            }
            
            setOptimizedFlowData(optimizedData);
            
            const type24Count = optimizedData.cells ? optimizedData.cells.filter(cell => cell.type === 24).length : 0;
            console.log(`📊 ${selectedMethod} data - type24Count: ${type24Count}, totalCells: ${optimizedData.cells ? optimizedData.cells.length : 0}`);
            
            // Calculate viewport after setting the data
            setTimeout(() => calculateViewport(optimizedData), 10);
          } catch (error) {
            console.error(`❌ Failed to apply ${selectedMethod} layout:`, error);
            // Fallback to original data
            calculateViewport(flowData);
          }
        }
      }, 50);
    }
  }, [selectedMethod, flowData]);

  // Reapply overlap optimization when toggle changes
  useEffect(() => {
    if (flowData && selectedMethod !== 'original' && optimizedFlowData) {
      console.log(`🔄 Overlap optimization toggle changed to: ${enableOverlapOptimization}`);
      
      // Clear and reapply layout with new overlap optimization setting
      setTimeout(() => {
        try {
          let optimizedData = applyLayoutMethod(flowData, selectedMethod);
          
          // Apply overlap optimization if enabled
          if (enableOverlapOptimization) {
            console.log('🔧 Applying overlap optimization...');
            optimizedData = applyOverlapOptimization(optimizedData);
          }
          
          setOptimizedFlowData(optimizedData);
          
          const type24Count = optimizedData.cells ? optimizedData.cells.filter(cell => cell.type === 24).length : 0;
          console.log(`📊 ${selectedMethod} data with overlap optimization - type24Count: ${type24Count}, totalCells: ${optimizedData.cells ? optimizedData.cells.length : 0}`);
          
          // Calculate viewport after setting the data
          setTimeout(() => calculateViewport(optimizedData), 10);
        } catch (error) {
          console.error(`❌ Failed to reapply layout with overlap optimization:`, error);
        }
      }, 50);
    }
  }, [enableOverlapOptimization, flowData, selectedMethod]);

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

      // Clear previous data to prevent persistence
      setFlowData(null);
      setOptimizedFlowData(null);
      console.log('🧹 Cleared previous flow data');

      const response = await fetch(`/${fileName}`);
      const data = await response.json();
      setFlowData(data);
      console.log('📁 Loaded new flow data:', data.scriptName);
      
      // Create optimized layout
      try {
        const optimized = applyLayoutMethod(data, 'optimized');
        setOptimizedFlowData(optimized);
        console.log('✅ Optimized layout created successfully');
      } catch (error) {
        console.error('❌ Failed to create optimized layout:', error);
        setOptimizedFlowData(null);
      }
      
      // Apply selected method with proper centering
      setTimeout(() => {
      applySelectedMethod(data);
      }, 50);
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
    if (selectedMethod === 'original') {
      calculateViewport(data);
    } else if (optimizedFlowData) {
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

    // Get the actual SVG container dimensions
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const headerHeight = 120; // Approximate header height
    
    // SVG container dimensions (matches the SVG height="calc(100vh - 120px)")
    const svgContainerWidth = screenWidth;
    const svgContainerHeight = screenHeight - headerHeight;
    
    // Calculate the middle 75% area within the SVG container
    const availableWidth = svgContainerWidth * 0.75;
    const availableHeight = svgContainerHeight * 0.75;
    
    // Center the 75% area within the SVG container
    const viewportWidth = availableWidth;
    const viewportHeight = availableHeight;
    const viewportOffsetX = (svgContainerWidth - availableWidth) / 2;
    const viewportOffsetY = (svgContainerHeight - availableHeight) / 2;

    const scaleX = viewportWidth / width;
    const scaleY = viewportHeight / height;
    const scale = Math.min(scaleX, scaleY, 1);

    // Ensure minimum scale for very small flow charts
    const minScale = 0.1;
    const finalScale = Math.max(scale, minScale);

    // Calculate the center of the flow chart
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // Calculate offset to center the flow chart in the viewport
    const offsetX = viewportOffsetX + (viewportWidth / 2) - (centerX * finalScale);
    const offsetY = viewportOffsetY + (viewportHeight / 2) - (centerY * finalScale);

    console.log(`📐 Viewport calculation:`);
    console.log(`  Screen: ${screenWidth}x${screenHeight}`);
    console.log(`  SVG Container: ${svgContainerWidth}x${svgContainerHeight}`);
    console.log(`  Available (75%): ${viewportWidth}x${viewportHeight}`);
    console.log(`  Flow bounds: ${width.toFixed(0)}x${height.toFixed(0)} (${minX.toFixed(0)},${minY.toFixed(0)} to ${maxX.toFixed(0)},${maxY.toFixed(0)})`);
    console.log(`  Scale: ${finalScale.toFixed(2)}, Offset: (${offsetX.toFixed(0)}, ${offsetY.toFixed(0)})`);
    console.log(`  Center: (${centerX.toFixed(0)}, ${centerY.toFixed(0)})`);

    setZoom(finalScale);
    setOffset({ x: offsetX, y: offsetY });
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

  // Download current layout as JSON
  const downloadCurrentLayout = () => {
    const currentData = getCurrentData();
    if (!currentData) {
      console.error('❌ No data to download');
      return;
    }

    // Create a deep copy of the current data
    const dataToDownload = JSON.parse(JSON.stringify(currentData));
    
    // Remove any metadata that might have been added - keep only original structure
    delete dataToDownload.layoutInfo;

    // Create filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `${dataToDownload.scriptName || 'flow'}_${selectedMethod}${enableOverlapOptimization ? '_optimized' : ''}_${timestamp}.json`;

    // Create and trigger download
    const blob = new Blob([JSON.stringify(dataToDownload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    const rerouteCount = dataToDownload.cells ? dataToDownload.cells.filter(cell => cell.type === 24).length : 0;
    console.log(`📥 Downloaded layout: ${filename}`);
    console.log(`📊 Cells: ${dataToDownload.cells ? dataToDownload.cells.length : 0}, Reroutes: ${rerouteCount}`);
  };

  // Rendering functions
  const getCurrentData = () => {
    const data = selectedMethod === 'original' ? flowData : optimizedFlowData;
    if (data) {
      const type24Count = data.cells ? data.cells.filter(cell => cell.type === 24).length : 0;
      console.log(`🔍 getCurrentData: method=${selectedMethod}, type24Count=${type24Count}, totalCells=${data.cells ? data.cells.length : 0}`);
    } else {
      console.log(`🔍 getCurrentData: method=${selectedMethod}, data=null (${selectedMethod === 'original' ? 'flowData' : 'optimizedFlowData'})`);
    }
    return data;
  };

  const renderConnections = () => {
    const currentData = getCurrentData();
    if (!currentData || !currentData.cells) return null;

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
    if (!currentData || !currentData.cells) return null;

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
          
          <div className="control-group">
            <label htmlFor="overlap-optimization-toggle">
              <input
                id="overlap-optimization-toggle"
                type="checkbox"
                checked={enableOverlapOptimization}
                onChange={(e) => setEnableOverlapOptimization(e.target.checked)}
                className="overlap-toggle"
              />
              Overlap Optimization (U/N-shaped rerouting)
            </label>
          </div>
          
          <div className="control-group">
            <button
              onClick={downloadCurrentLayout}
              className="download-button"
              disabled={!getCurrentData()}
            >
              📥 Download Current Layout
            </button>
          </div>
          
          <div className="zoom-info">
            Zoom: {Math.round(zoom * 100)}% | Drag to pan
          </div>
        </div>
      </header>
      
      <main className="visualization-container">
        {flowData && getCurrentData() && (
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