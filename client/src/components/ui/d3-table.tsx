import { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { Mark } from '@shared/schema';

interface D3MarksTableProps {
  marks: Mark[];
  className?: string;
}

// Simulated real-time marks data (for demo)
interface RealTimeMark {
  id: string;
  mark: number;
  label: string;
  justification: string;
  internalRoute: string;
}

export function D3MarksTable({ marks, className = "" }: D3MarksTableProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const barChartRef = useRef<SVGSVGElement>(null);
  const pieChartRef = useRef<SVGSVGElement>(null);
  const [realTimeMarks, setRealTimeMarks] = useState<RealTimeMark[]>([
    { id: "1", mark: 12, label: "Row 1", justification: "Good analysis", internalRoute: "/analysis" },
    { id: "2", mark: 13, label: "Row 2", justification: "Excellent presentation", internalRoute: "/presentation" },
    { id: "3", mark: 10, label: "Row 3", justification: "Lacks depth", internalRoute: "/summary" }
  ]);

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Randomly modify one of the marks by +/-1
      setRealTimeMarks(prevMarks => {
        const newMarks = [...prevMarks];
        const randomIndex = Math.floor(Math.random() * newMarks.length);
        const change = Math.random() > 0.5 ? 1 : -1;
        
        // Only change if within reasonable bounds (8-15)
        if (newMarks[randomIndex].mark + change >= 8 && newMarks[randomIndex].mark + change <= 15) {
          newMarks[randomIndex] = {
            ...newMarks[randomIndex],
            mark: newMarks[randomIndex].mark + change
          };
        }
        
        return newMarks;
      });
    }, 5000); // Update every 5 seconds
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!marks.length || !svgRef.current || !containerRef.current) return;

    // Clear existing elements
    d3.select(svgRef.current).selectAll('*').remove();
    
    if (barChartRef.current) {
      d3.select(barChartRef.current).selectAll('*').remove();
    }
    
    if (pieChartRef.current) {
      d3.select(pieChartRef.current).selectAll('*').remove();
    }

    // Render table using D3
    renderTable();
    
    // Render bar chart
    renderBarChart();
    
    // Render pie chart
    renderPieChart();

    // Handle window resize
    const handleResize = () => {
      d3.select(svgRef.current).selectAll('*').remove();
      
      if (barChartRef.current) {
        d3.select(barChartRef.current).selectAll('*').remove();
      }
      
      if (pieChartRef.current) {
        d3.select(pieChartRef.current).selectAll('*').remove();
      }
      
      renderTable();
      renderBarChart();
      renderPieChart();
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [marks, realTimeMarks]);

  // Render the Marks Table based on the screenshot
  const renderTable = () => {
    const svg = d3.select(svgRef.current);
    const containerWidth = containerRef.current?.clientWidth || 800;
    
    // Set SVG dimensions
    svg.attr('width', containerWidth)
       .attr('height', (realTimeMarks.length + 1) * 50);
    
    // Column widths
    const colWidths = [
      containerWidth * 0.15, // Mark
      containerWidth * 0.55, // Justification
      containerWidth * 0.3   // Internal Route
    ];
    
    // Headers
    const headers = ['mark', 'justification for this marking', 'internal route'];
    
    // Create header row
    const headerRow = svg.append('g')
      .attr('class', 'header-row')
      .attr('transform', 'translate(0,0)');
    
    // Create background for header with a border
    headerRow.append('rect')
      .attr('width', containerWidth)
      .attr('height', 40)
      .attr('fill', '#ffffff')
      .attr('stroke', '#e5e7eb')
      .attr('stroke-width', 1);
    
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
      .data(realTimeMarks)
      .enter()
      .append('g')
      .attr('class', 'data-row')
      .attr('transform', (d, i) => `translate(0,${(i + 1) * 50})`);
    
    // Create background for rows with borders
    rows.append('rect')
      .attr('width', containerWidth)
      .attr('height', 50)
      .attr('fill', '#ffffff')
      .attr('stroke', '#e5e7eb')
      .attr('stroke-width', 1);
    
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
        .text(d.justification);
      
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
  };

  // Render the Bar Chart for real-time marks visualization
  const renderBarChart = () => {
    if (!barChartRef.current) return;
    
    const chart = d3.select(barChartRef.current);
    const containerWidth = containerRef.current?.clientWidth || 800;
    const chartHeight = 280;
    
    // Set chart dimensions
    chart.attr('width', containerWidth)
         .attr('height', chartHeight);
    
    // Prepare data
    const data = realTimeMarks.map(d => ({
      label: d.label,
      value: d.mark
    }));
    
    // Create scales
    const xScale = d3.scaleBand()
      .domain(data.map(d => d.label))
      .range([60, containerWidth - 30])
      .padding(0.3);
    
    const yScale = d3.scaleLinear()
      .domain([0, 15]) // Fixed range for marks from 0-15
      .range([chartHeight - 60, 30]);
    
    // Create axes
    const xAxis = d3.axisBottom(xScale);
    const yAxis = d3.axisLeft(yScale)
      .ticks(8)
      .tickFormat(d => `${d}`);
    
    // Add grid lines
    chart.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(60,0)`)
      .call(d3.axisLeft(yScale)
        .ticks(8)
        .tickSize(-containerWidth + 90)
        .tickFormat(() => '')
      )
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('.tick line')
        .attr('stroke', '#e5e7eb')
        .attr('stroke-width', 0.5)
      );
    
    // Add X axis
    chart.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${chartHeight - 60})`)
      .call(xAxis)
      .selectAll('text')
      .attr('font-size', '12px');
    
    // Add Y axis
    chart.append('g')
      .attr('class', 'y-axis')
      .attr('transform', 'translate(60,0)')
      .call(yAxis);
    
    // Add bars with animation
    chart.selectAll('.bar')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', d => xScale(d.label) as number)
      .attr('width', xScale.bandwidth())
      .attr('y', yScale(0))
      .attr('height', 0)
      .attr('fill', '#4F46E5')
      .attr('rx', 3)
      .attr('ry', 3)
      .transition()
      .duration(800)
      .attr('y', d => yScale(d.value))
      .attr('height', d => chartHeight - 60 - yScale(d.value));
    
    // Add value labels on top of bars
    chart.selectAll('.value-label')
      .data(data)
      .enter()
      .append('text')
      .attr('class', 'value-label')
      .attr('x', d => (xScale(d.label) as number) + xScale.bandwidth() / 2)
      .attr('y', d => yScale(d.value) - 10)
      .attr('text-anchor', 'middle')
      .attr('font-size', '14px')
      .attr('font-weight', 'bold')
      .attr('fill', '#4F46E5')
      .text(d => d.value);
    
    // Add title
    chart.append('text')
      .attr('x', containerWidth / 2)
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .attr('font-size', '16px')
      .attr('font-weight', 'bold')
      .attr('fill', '#111827')
      .text('Marks Visualization (Bar Chart)');
  };
  
  // Render Pie Chart for the distribution
  const renderPieChart = () => {
    if (!pieChartRef.current) return;
    
    const chart = d3.select(pieChartRef.current);
    const containerWidth = containerRef.current?.clientWidth || 800;
    const chartHeight = 300;
    const radius = Math.min(containerWidth, chartHeight) / 2 - 40;
    
    // Set chart dimensions
    chart.attr('width', containerWidth)
         .attr('height', chartHeight);
    
    // Prepare data
    const data = realTimeMarks.map(d => ({
      name: d.label,
      value: d.mark
    }));
    
    const total = data.reduce((sum, d) => sum + d.value, 0);
    
    // Color scale
    const colors = d3.scaleOrdinal()
      .domain(data.map(d => d.name))
      .range(['#4F46E5', '#10B981', '#F59E0B']);
    
    // Pie chart setup
    const pie = d3.pie<typeof data[0]>()
      .value(d => d.value)
      .sort(null);
    
    const arc = d3.arc<d3.PieArcDatum<typeof data[0]>>()
      .innerRadius(0)
      .outerRadius(radius);
    
    const arcLabel = d3.arc<d3.PieArcDatum<typeof data[0]>>()
      .innerRadius(radius * 0.6)
      .outerRadius(radius * 0.6);
    
    // Create pie chart group
    const g = chart.append('g')
      .attr('transform', `translate(${containerWidth / 2}, ${chartHeight / 2})`);
    
    // Add arcs
    const arcs = g.selectAll('.arc')
      .data(pie(data))
      .enter()
      .append('g')
      .attr('class', 'arc');
    
    // Add path with animation
    arcs.append('path')
      .attr('d', arc)
      .attr('fill', d => colors(d.data.name) as string)
      .attr('stroke', 'white')
      .attr('stroke-width', 2)
      .transition()
      .duration(1000)
      .attrTween('d', function(d) {
        const interpolate = d3.interpolate(
          { startAngle: 0, endAngle: 0 },
          { startAngle: d.startAngle, endAngle: d.endAngle }
        );
        return function(t) {
          return arc(interpolate(t) as any);
        };
      });
    
    // Add labels
    arcs.append('text')
      .attr('transform', d => `translate(${arcLabel.centroid(d)})`)
      .attr('text-anchor', 'middle')
      .attr('font-size', '14px')
      .attr('font-weight', 'bold')
      .attr('fill', 'white')
      .text(d => `${d.data.value}`);
    
    // Add percentage labels
    arcs.append('text')
      .attr('transform', d => {
        const pos = arcLabel.centroid(d);
        return `translate(${pos[0]}, ${pos[1] + 20})`;
      })
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('fill', 'white')
      .text(d => `${Math.round((d.data.value / total) * 100)}%`);
    
    // Add legend
    const legendG = chart.append('g')
      .attr('transform', `translate(${containerWidth - 120}, 30)`);
    
    const legend = legendG.selectAll('.legend')
      .data(data)
      .enter()
      .append('g')
      .attr('class', 'legend')
      .attr('transform', (d, i) => `translate(0, ${i * 25})`);
    
    legend.append('rect')
      .attr('width', 15)
      .attr('height', 15)
      .attr('fill', d => colors(d.name) as string);
    
    legend.append('text')
      .attr('x', 25)
      .attr('y', 12.5)
      .attr('font-size', '12px')
      .text(d => `${d.name}: ${d.value}`);
    
    // Add title
    chart.append('text')
      .attr('x', containerWidth / 2)
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .attr('font-size', '16px')
      .attr('font-weight', 'bold')
      .attr('fill', '#111827')
      .text('Marks Distribution (Pie Chart)');
  };

  return (
    <div className={`d3-marks-table ${className}`} ref={containerRef}>
      <h3 className="text-xl font-bold mb-4">Marks Table (D3.js)</h3>
      <svg ref={svgRef} className="w-full border rounded-md"></svg>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <div className="col-span-1">
          <svg ref={barChartRef} className="w-full h-full bg-white border rounded-md p-4"></svg>
        </div>
        <div className="col-span-1">
          <svg ref={pieChartRef} className="w-full h-full bg-white border rounded-md p-4"></svg>
        </div>
      </div>
    </div>
  );
}
