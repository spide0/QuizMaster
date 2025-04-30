import { useRef, useEffect } from 'react';
import * as d3 from 'd3';

interface TableData {
  headers: string[];
  rows: Record<string, string | number>[];
}

interface D3TableProps {
  data: TableData;
  width?: number;
  height?: number;
  cellPadding?: number;
  colorScale?: string[]; // Array of colors for scale
  headerColor?: string;
  borderColor?: string;
  textColor?: string;
  highlightColor?: string;
  valueKey?: string; // Key to use for color scaling
}

export function D3Table({
  data,
  width = 800,
  height = 400,
  cellPadding = 10,
  colorScale = ['#f8fafc', '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b', '#475569'],
  headerColor = '#1e293b',
  borderColor = '#cbd5e1',
  textColor = '#334155',
  highlightColor = '#3b82f6',
  valueKey
}: D3TableProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  
  useEffect(() => {
    if (!svgRef.current || !data || !data.rows || data.rows.length === 0) return;
    
    // Clear any existing SVG content
    d3.select(svgRef.current).selectAll('*').remove();
    
    const svg = d3.select(svgRef.current);
    
    // Calculate cell dimensions
    const cellHeight = 40;
    const tableHeight = (data.rows.length + 1) * cellHeight; // +1 for header row
    const headerHeight = 50;
    
    // Set actual height based on content or provided height
    const actualHeight = Math.min(height, tableHeight + 100); // Add some padding
    
    // Set SVG dimensions
    svg.attr('width', width)
       .attr('height', actualHeight)
       .attr('viewBox', `0 0 ${width} ${actualHeight}`)
       .attr('preserveAspectRatio', 'xMidYMid meet');
    
    // Create table container
    const table = svg.append('g')
                     .attr('transform', 'translate(0, 20)');
    
    // Calculate column widths based on data
    const columnWidths: number[] = [];
    const totalPadding = cellPadding * 2;
    
    // Determine column widths based on content
    data.headers.forEach((header, i) => {
      // Start with header width
      let maxWidth = header.length * 8 + totalPadding;
      
      // Check data row widths
      data.rows.forEach(row => {
        const cellValue = String(row[header]);
        const cellWidth = cellValue.length * 7 + totalPadding;
        maxWidth = Math.max(maxWidth, cellWidth);
      });
      
      // Set minimum width
      columnWidths[i] = Math.max(maxWidth, 80);
    });
    
    // Calculate total table width
    const tableWidth = columnWidths.reduce((sum, width) => sum + width, 0);
    const scale = tableWidth > width ? width / tableWidth : 1;
    
    // Apply scale if table is wider than available width
    if (scale < 1) {
      columnWidths.forEach((w, i) => {
        columnWidths[i] = w * scale;
      });
    }
    
    // Create a color scale if valueKey is provided
    let colorScaleFn: d3.ScaleLinear<string, string, never> | null = null;
    
    if (valueKey && colorScale) {
      // Find min and max values for the valueKey
      const values = data.rows.map(row => Number(row[valueKey])).filter(v => !isNaN(v));
      const min = Math.min(...values);
      const max = Math.max(...values);
      
      colorScaleFn = d3.scaleLinear<string>()
        .domain(Array.from({ length: colorScale.length }, (_, i) => 
          min + (max - min) * (i / (colorScale.length - 1))
        ))
        .range(colorScale);
    }
    
    // Draw header row
    const headers = table.append('g')
      .attr('class', 'headers');
    
    headers.selectAll('rect')
      .data(data.headers)
      .enter()
      .append('rect')
      .attr('x', (_, i) => {
        let x = 0;
        for (let j = 0; j < i; j++) {
          x += columnWidths[j];
        }
        return x;
      })
      .attr('y', 0)
      .attr('width', (_, i) => columnWidths[i])
      .attr('height', headerHeight)
      .attr('fill', headerColor)
      .attr('stroke', borderColor)
      .attr('stroke-width', 1);
    
    headers.selectAll('text')
      .data(data.headers)
      .enter()
      .append('text')
      .attr('x', (_, i) => {
        let x = 0;
        for (let j = 0; j < i; j++) {
          x += columnWidths[j];
        }
        return x + columnWidths[i] / 2;
      })
      .attr('y', headerHeight / 2)
      .attr('dy', '.35em')
      .attr('text-anchor', 'middle')
      .attr('fill', 'white')
      .attr('font-weight', 'bold')
      .text(d => d);
    
    // Draw data rows
    const rows = table.append('g')
      .attr('class', 'rows')
      .attr('transform', `translate(0, ${headerHeight})`);
    
    const rowGroups = rows.selectAll('g')
      .data(data.rows)
      .enter()
      .append('g')
      .attr('class', 'row')
      .attr('transform', (_, i) => `translate(0, ${i * cellHeight})`);
    
    // Add row background rectangles
    rowGroups.selectAll('rect')
      .data((d, i) => data.headers.map(header => ({
        header,
        value: d[header],
        rowIndex: i
      })))
      .enter()
      .append('rect')
      .attr('x', (d, i) => {
        let x = 0;
        for (let j = 0; j < i; j++) {
          x += columnWidths[j];
        }
        return x;
      })
      .attr('y', 0)
      .attr('width', (_, i) => columnWidths[i])
      .attr('height', cellHeight)
      .attr('fill', d => {
        // If this cell is using the value key for coloring
        if (colorScaleFn && d.header === valueKey) {
          return colorScaleFn(Number(d.value));
        }
        // Alternating row colors
        return d.rowIndex % 2 === 0 ? '#f8fafc' : '#f1f5f9';
      })
      .attr('stroke', borderColor)
      .attr('stroke-width', 0.5)
      .on('mouseover', function() {
        d3.select(this).attr('fill', highlightColor).attr('fill-opacity', 0.3);
      })
      .on('mouseout', function(d) {
        const rowIndex = (d as any).rowIndex;
        let fillColor = rowIndex % 2 === 0 ? '#f8fafc' : '#f1f5f9';
        
        if (colorScaleFn && (d as any).header === valueKey) {
          fillColor = colorScaleFn(Number((d as any).value));
        }
        
        d3.select(this).attr('fill', fillColor).attr('fill-opacity', 1);
      });
    
    // Add row text
    rowGroups.selectAll('text')
      .data((d, i) => data.headers.map(header => ({
        header,
        value: d[header],
        rowIndex: i
      })))
      .enter()
      .append('text')
      .attr('x', (d, i) => {
        let x = 0;
        for (let j = 0; j < i; j++) {
          x += columnWidths[j];
        }
        return x + columnWidths[i] / 2;
      })
      .attr('y', cellHeight / 2)
      .attr('dy', '.35em')
      .attr('text-anchor', 'middle')
      .attr('fill', d => {
        // If this is the value column, maybe use white text for better contrast
        if (colorScaleFn && d.header === valueKey && Number(d.value) > (colorScaleFn.domain()[colorScaleFn.domain().length - 2])) {
          return 'white';
        }
        return textColor;
      })
      .text(d => String(d.value));
    
    // Add legend if using color scale
    if (colorScaleFn && valueKey) {
      const legendWidth = 200;
      const legendHeight = 20;
      const legendX = width - legendWidth - 20;
      const legendY = tableHeight + 30;
      
      // Create a gradient for the legend
      const domain = colorScaleFn.domain();
      const defs = svg.append('defs');
      
      const gradient = defs.append('linearGradient')
        .attr('id', 'legend-gradient')
        .attr('x1', '0%')
        .attr('y1', '0%')
        .attr('x2', '100%')
        .attr('y2', '0%');
      
      colorScale.forEach((color, i) => {
        gradient.append('stop')
          .attr('offset', `${(i / (colorScale.length - 1)) * 100}%`)
          .attr('stop-color', color);
      });
      
      // Create legend rectangle
      const legend = svg.append('g')
        .attr('class', 'legend')
        .attr('transform', `translate(${legendX}, ${legendY})`);
      
      legend.append('rect')
        .attr('width', legendWidth)
        .attr('height', legendHeight)
        .style('fill', 'url(#legend-gradient)')
        .attr('stroke', borderColor)
        .attr('stroke-width', 0.5);
      
      // Add legend title
      legend.append('text')
        .attr('x', legendWidth / 2)
        .attr('y', -5)
        .attr('text-anchor', 'middle')
        .attr('font-size', '12px')
        .attr('fill', textColor)
        .text(`${valueKey} Value Scale`);
      
      // Add min and max labels
      legend.append('text')
        .attr('x', 0)
        .attr('y', legendHeight + 15)
        .attr('text-anchor', 'start')
        .attr('font-size', '10px')
        .attr('fill', textColor)
        .text(Math.round(domain[0]));
      
      legend.append('text')
        .attr('x', legendWidth)
        .attr('y', legendHeight + 15)
        .attr('text-anchor', 'end')
        .attr('font-size', '10px')
        .attr('fill', textColor)
        .text(Math.round(domain[domain.length - 1]));
    }
    
  }, [data, width, height, cellPadding, colorScale, headerColor, borderColor, textColor, highlightColor, valueKey]);
  
  return (
    <div className="d3-table-container overflow-auto">
      <svg ref={svgRef} className="d3-table w-full h-full"></svg>
    </div>
  );
}