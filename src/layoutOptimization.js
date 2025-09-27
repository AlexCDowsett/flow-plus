// Layout Optimization Methods
// This file imports and manages all optimization methods

// Import all optimization methods
import { originalLayout } from './optimization/originalLayout.js';
import { gridLayout } from './optimization/gridLayout.js';
import { sugiyamaFlowLayout } from './optimization/sugiyamaFlow.js';
import { hierarchicalLayout } from './optimization/hierarchicalLayout.js';
import { forceDirectedLayout } from './optimization/forceDirectedLayout.js';
import { orthogonalLayout } from './optimization/orthogonalLayout.js';
import { circularLayout } from './optimization/circularLayout.js';

/**
 * Get available layout methods
 * @returns {Array} - Array of available layout method objects
 */
export const getLayoutMethods = () => [
  { value: 'original', label: 'Original Layout', method: originalLayout },
  { value: 'grid', label: 'Grid Layout', method: gridLayout },
  { value: 'hierarchical', label: 'Hierarchical Layout', method: hierarchicalLayout },
  { value: 'force', label: 'Force-Directed Layout', method: forceDirectedLayout },
  { value: 'orthogonal', label: 'Orthogonal Layout', method: orthogonalLayout },
  { value: 'circular', label: 'Circular Layout', method: circularLayout },
  { value: 'sugiyama', label: 'Sugiyama Flow Layout', method: sugiyamaFlowLayout }
];

/**
 * Apply a layout method to flow data
 * @param {Object} data - The flow data object
 * @param {string} methodName - Name of the method to apply
 * @returns {Object} - Processed flow data
 */
export const applyLayoutMethod = (data, methodName) => {
  const methods = getLayoutMethods();
  const method = methods.find(m => m.value === methodName);
  
  if (!method) {
    console.error(`❌ Unknown layout method: ${methodName}`);
    return data;
  }
  
  return method.method(data);
};