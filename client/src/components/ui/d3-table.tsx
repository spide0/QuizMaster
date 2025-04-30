import { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { Mark } from '@shared/schema';

interface D3MarksTableProps {
  marks: Mark[];
  className?: string;
}

export function D3MarksTable({ marks, className = "" }: D3MarksTableProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!marks.length || !svgRef.current || !chartRef.current || !containerRef.current) return;

    // Clear existing elements
    d3.select(svgRef.current).selectAll('*').remove();
    d3.select(chartRef.current).selectAll('*').remove();

    // Render table using D3
    renderTable();
    
    // Render bar chart
    renderChart();

    // Handle window resize
    const handleResize = () => {
      d3.select(svgRef.current).selectAll('*').remove();
      d3.select(chartRef.current).selectAll('*').remove();
      renderTable();
      renderChart();
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [marks]);

  const renderTable = () => {
    const svg = d3.select(svgRef.current);
    const containerWidth = containerRef.current?.clientWidth || 800;
    
    // Set SVG dimensions
    svg.attr('width', containerWidth)
       .attr('height', (marks.length + 1) * 50);
    
    // Column widths
    const colWidths = [
      containerWidth * 0.15, // Mark
      containerWidth * 0.55, // Justification
      containerWidth * 0.3   // Internal Route
    ];
    
    // Headers
    const headers = ['Mark', 'Justification for this marking', 'Internal route'];
    
    // Create header row
    const headerRow = svg.append('g')
      .attr('class', 'header-row')
      .attr('transform', 'translate(0,0)');
    
    // Create background for header
    headerRow.append('rect')
      .attr('width', containerWidth)
      .attr('height', 40)
      .attr('fill', '#f9fafb');
    
    // Add header texts
    let xOffset = 0;
    headers.forEach((header, i) => {
      headerRow.append('text')
        .attr('x', xOffset + 10)
        .attr('y', 25)
        .attr('fill', '#111827')
        .attr('font-weight', 'bold')
        .text(header);
      
      if (i < headers.length - 1) {
        headerRow.append('line')
          .attr('x1', xOffset + colWidths[i])
          .attr('y1', 0)
          .attr('x2', xOffset + colWidths[i])
          .attr('y2', 40)
          .attr('stroke', '#e5e7eb')
          .attr('stroke-width', 1);
      }
      
      xOffset += colWidths[i];
    });
    
    // Create data rows
    const rows = svg.selectAll('.data-row')
      .data(marks)
      .enter()
      .append('g')
      .attr('class', 'data-row')
      .attr('transform', (d, i) => `translate(0,${(i + 1) * 50})`);
    
    // Create background for rows (alternating colors)
    rows.append('rect')
      .attr('width', containerWidth)
      .attr('height', 50)
      .attr('fill', (d, i) => i % 2 === 0 ? '#ffffff' : '#f9fafb');
    
    // Add row data
    rows.each(function(d, i) {
      const row = d3.select(this);
      let xOffset = 0;
      
      // Mark column
      row.append('text')
        .attr('x', xOffset + 10)
        .attr('y', 30)
        .attr('fill', '#111827')
        .attr('font-weight', 'medium')
        .text(d.mark);
      
      // Divider
      row.append('line')
        .attr('x1', xOffset + colWidths[0])
        .attr('y1', 0)
        .attr('x2', xOffset + colWidths[0])
        .attr('y2', 50)
        .attr('stroke', '#e5e7eb')
        .attr('stroke-width', 1);
      
      xOffset += colWidths[0];
      
      // Justification column
      row.append('text')
        .attr('x', xOffset + 10)
        .attr('y', 30)
        .attr('fill', '#4b5563')
        .text(() => {
          const maxLength = 50;
          return d.justification.length > maxLength 
            ? d.justification.substring(0, maxLength) + '...' 
            : d.justification;
        });
      
      // Divider
      row.append('line')
        .attr('x1', xOffset + colWidths[1])
        .attr('y1', 0)
        .attr('x2', xOffset + colWidths[1])
        .attr('y2', 50)
        .attr('stroke', '#e5e7eb')
        .attr('stroke-width', 1);
      
      xOffset += colWidths[1];
      
      // Internal route column
      row.append('text')
        .attr('x', xOffset + 10)
        .attr('y', 30)
        .attr('fill', '#4b5563')
        .text(d.internalRoute);
    });
    
    // Add bottom line
    svg.append('line')
      .attr('x1', 0)
      .attr('y1', (marks.length + 1) * 50)
      .attr('x2', containerWidth)
      .attr('y2', (marks.length + 1) * 50)
      .attr('stroke', '#e5e7eb')
      .attr('stroke-width', 1);
  };

  const renderChart = () => {
    // Visualization of threshold distribution
    const chart = d3.select(chartRef.current);
    const containerWidth = containerRef.current?.clientWidth || 800;
    const chartHeight = 200;
    
    // Set chart dimensions
    chart.attr('width', containerWidth)
         .attr('height', chartHeight);
    
    // Sort marks by threshold
    const sortedMarks = [...marks].sort((a, b) => a.threshold - b.threshold);
    
    // Create scales
    const xScale = d3.scaleBand()
      .domain(sortedMarks.map(d => d.mark))
      .range([50, containerWidth - 30])
      .padding(0.3);
    
    const yScale = d3.scaleLinear()
      .domain([0, 100])
      .range([chartHeight - 30, 30]);
    
    // Create axes
    const xAxis = d3.axisBottom(xScale);
    const yAxis = d3.axisLeft(yScale).ticks(5);
    
    // Add X axis
    chart.append('g')
      .attr('transform', `translate(0,${chartHeight - 30})`)
      .call(xAxis)
      .selectAll('text')
      .attr('font-size', '10px')
      .attr('text-anchor', 'end')
      .attr('transform', 'rotate(-45)');
    
    // Add Y axis
    chart.append('g')
      .attr('transform', 'translate(50,0)')
      .call(yAxis);
    
    // Add bars
    chart.selectAll('.bar')
      .data(sortedMarks)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', d => xScale(d.mark) as number)
      .attr('y', d => yScale(d.threshold))
      .attr('width', xScale.bandwidth())
      .attr('height', d => chartHeight - 30 - yScale(d.threshold))
      .attr('fill', '#4F46E5')
      .attr('rx', 3)
      .attr('ry', 3);
    
    // Add threshold values on top of bars
    chart.selectAll('.threshold-label')
      .data(sortedMarks)
      .enter()
      .append('text')
      .attr('class', 'threshold-label')
      .attr('x', d => (xScale(d.mark) as number) + xScale.bandwidth() / 2)
      .attr('y', d => yScale(d.threshold) - 5)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('fill', '#4b5563')
      .text(d => `${d.threshold}%`);
    
    // Add title
    chart.append('text')
      .attr('x', containerWidth / 2)
      .attr('y', 15)
      .attr('text-anchor', 'middle')
      .attr('font-size', '14px')
      .attr('font-weight', 'bold')
      .attr('fill', '#111827')
      .text('Grading Thresholds');
  };

  return (
    <div className={`d3-marks-table ${className}`} ref={containerRef}>
      <svg ref={svgRef} className="w-full"></svg>
      <div className="mt-8">
        <h3 className="text-md font-medium text-gray-900 mb-4">Distribution of Marks</h3>
        <svg ref={chartRef} className="w-full bg-gray-50 rounded p-4"></svg>
      </div>
    </div>
  );
}
