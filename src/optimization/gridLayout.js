// Grid Layout Method
// Simple grid-based layout for flow charts

// Constants for layout configuration
const LAYOUT_CONFIG = {
  cellSpacing: 200,
  startX: 100,
  startY: 200,
  minFontSize: 8,
  baseFontSize: 10,
  textOffset: 20
};

/**
 * Simple Grid Layout Method - Example of how to add new methods
 * @param {Object} data - The flow data object
 * @returns {Object} - Flow data with cells arranged in a simple grid
 */
export const gridLayout = (data) => {
  if (!data?.cells) {
    console.error('❌ Invalid data provided to gridLayout');
    return data;
  }

  console.log('🔧 Starting grid layout for data:', data.scriptName);
  
  const cells = data.cells.filter(cell => cell.type !== 24);
  const cols = Math.ceil(Math.sqrt(cells.length));
  const cellSize = 200;
  
  const positionedCells = cells.map((cell, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    
    return {
      ...cell,
      canvas: {
        ...cell.canvas,
        position: {
          x: LAYOUT_CONFIG.startX + col * cellSize,
          y: LAYOUT_CONFIG.startY + row * cellSize
        }
      }
    };
  });

  console.log('✅ Grid layout complete!');
  return { ...data, cells: positionedCells };
};
