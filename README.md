# Flow Chart Visualizer

A React-based flow chart visualization tool that can display and optimize flow diagrams from JSON data.

## Features

- **Interactive Flow Charts**: Zoom, pan, and explore flow diagrams
- **Layout Optimization**: Automatic left-to-right layout optimization
- **Type 24 Cell Handling**: Smart routing cell management for cleaner visualizations
- **Configurable Type Names**: Customizable cell type labels via JSON configuration
- **Multiple Layout Methods**: Switch between original and optimized layouts

## Project Structure

```
flow-plus/
├── public/
│   ├── index.html
│   ├── type-names.json          # Cell type name configuration
│   ├── ald_a_5_revision4.json   # Flow chart data
│   ├── EFR-SVCC Email Test_revision8.json
│   └── wheatley POC ID_revision20.json
├── src/
│   ├── App.js                   # Main application component
│   ├── App.css                  # Application styles
│   ├── index.js                 # React entry point
│   └── index.css                # Global styles
├── package.json
└── README.md
```

## Getting Started

1. Navigate to the flow-plus directory:
   ```bash
   cd flow-plus
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

4. Open your browser and navigate to `http://localhost:3000`

## Usage

1. **Select a Flow Chart**: Choose from the dropdown menu
2. **Choose Layout Method**: Switch between "Original Layout" and "Optimized Layout"
3. **Customize Display**: Adjust smoothing, cell sizes, and connection circle sizes
4. **Navigate**: Use mouse wheel to zoom, drag to pan

## Configuration

### Type Names
Edit `public/type-names.json` to customize cell type labels:

```json
{
  "typeNames": {
    "24": "Reroute",
    "1": "Play Prompt",
    "3": "Data Entry"
  }
}
```

### Layout Settings
Modify layout constants in `src/App.js`:

```javascript
const LAYOUT_CONFIG = {
  cellSpacing: 250,
  levelSpacing: 200,
  startX: 100,
  startY: 200
};
```

## Adding New Flow Charts

1. Add your JSON file to the `public/` directory
2. Update the `FILE_OPTIONS` array in `src/App.js`
3. Add the corresponding case in the `getFileName()` function

## Adding New Layout Methods

1. Add your method to the `OPTIMIZATION_METHODS` array
2. Implement the optimization logic in the `createOptimizedLayout()` function
3. Add the method handling in the `useEffect` for method changes

## Development

The project uses:
- React 18
- Modern JavaScript (ES6+)
- CSS3 for styling
- No external dependencies for the core functionality

## License

This project is part of the Flow Plus visualization suite.

