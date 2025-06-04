import React, { useState, useEffect } from 'react';
import './App.css';
import * as d3 from 'd3';

function BoundaryLayerSimulation({ onBack }) {
  // State variables for dynamically loaded values
  const [nuValues, setNuValues] = useState([]);
  const [uInfValues, setUInfValues] = useState([]);

  const [nu, setNu] = useState(null);
  const [uInf, setUInf] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [contourType, setContourType] = useState(null); // 'u_x' or 'u_y' or null

  // Define data range constants at component level
  const xMinData = 0.01;
  const xMaxData = 5.0;
  const yMinData = 0.0;
  const yMaxData = 0.4;

  useEffect(() => {
    console.log('Starting data load...');
    fetch('/data.csv')
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.text();
      })
      .then(text => {
        const rows = text.split('\n').slice(1); // Skip header
        const allPoints = [];
        const uniqueNu = new Set();
        const uniqueUInf = new Set();

        rows.forEach(row => {
          if (row.trim()) {
            const [nu_m2s, U_inf_ms, x_m, y_m, Re_x, u_m_per_s, v_m_per_s] = row.split(',').map(Number);
            
            allPoints.push({ 
              nu_val: nu_m2s, 
              u_inf: U_inf_ms, 
              x: x_m, 
              y: y_m,
              re_x: Re_x, 
              delta99: null, // delta99 is not in this CSV, will use formula
              U_x: u_m_per_s,
              U_y: v_m_per_s,
              eta: null // eta is not in this CSV
            });
            uniqueNu.add(nu_m2s);
            uniqueUInf.add(U_inf_ms);
          }
        });

        const sortedNu = Array.from(uniqueNu).sort((a, b) => a - b);
        const sortedUInf = Array.from(uniqueUInf).sort((a, b) => a - b);

        console.log('Data loaded:', {
          totalPoints: allPoints.length,
          uniqueNuCount: sortedNu.length,
          uniqueUInfCount: sortedUInf.length,
          sampleNu: sortedNu.slice(0, 5),
          sampleUInf: sortedUInf.slice(0, 5),
        });

        setNuValues(sortedNu);
        setUInfValues(sortedUInf);
        setNu(sortedNu[0]); // Set initial nu to the first unique value
        setUInf(sortedUInf[0]); // Set initial uInf to the first unique value
        setData(allPoints.sort((a, b) => a.y - b.y || a.x - b.x)); // Sort data by y then x
        setLoading(false);
      })
      .catch(error => {
        console.error('Error loading data:', error);
        setError(error.message);
        setLoading(false);
      });
  }, []);

  const getCurrentPoints = () => {
    // Ensure data and initial values are loaded before filtering
    if (!data || nu === null || uInf === null) return { boundaryLayer: [], contour: [] };

    const epsilon = 1e-9; // Tolerance for floating-point comparison

    // Get all 800 points for the current nu and uInf
    const currentCasePoints = data.filter(point => {
      const nuMatch = Math.abs(point.nu_val - nu) < epsilon;
      const uMatch = Math.abs(point.u_inf - uInf) < epsilon;
      return nuMatch && uMatch;
    }).sort((a, b) => a.y - b.y || a.x - b.x); // Sort by y, then x for grid processing

    if (currentCasePoints.length === 0) {
      console.log('No data found for:', { nu, uInf });
      return { boundaryLayer: [], contour: [] };
    }

    // Calculate boundary layer points using the formula delta = 4.92 * sqrt(nu * x / U_inf)
    // We only need one point per x-location for the boundary layer line
    const boundaryLayerPoints = [];
    const uniqueXValues = Array.from(new Set(currentCasePoints.map(p => p.x))).sort((a, b) => a - b);

    uniqueXValues.forEach(x => {
      // Avoid division by zero if uInf is zero, although data likely has uInf > 0
      if (uInf > epsilon) {
         const delta99_calculated = 4.92 * Math.sqrt((nu * x) / uInf);
         boundaryLayerPoints.push({ x, delta99: delta99_calculated });
      }
    });

    console.log('Filtering for:', { nu, uInf });
    console.log('Current case points count:', currentCasePoints.length);
    console.log('Calculated boundary layer points count:', boundaryLayerPoints.length);

    // Return both the calculated boundary layer points and all points for the contour
    return { boundaryLayer: boundaryLayerPoints, contour: currentCasePoints };
  };

  // Calculate Reynolds number using the x value of the last point
  // Use points from the current case for Reynolds number calculation
  const currentCasePoints = getCurrentPoints().contour; // Get contour points to find the last x
  const lastPoint = currentCasePoints.length > 0 ? currentCasePoints[currentCasePoints.length - 1] : null;
  const currentRe = (lastPoint && nu !== null && uInf !== null) ? (uInf * lastPoint.x) / nu : 'N/A';

  return (
    <div className="flex flex-col md:flex-row gap-4 p-2 w-full h-screen bg-[#f0f0f0]"> {/* Light grey background */}
      {/* Plot section takes full width on small screens, 2/3 on medium+ */}
      <div className="w-full md:w-2/3 bg-[#ffffff] p-6 rounded-xl shadow-md flex flex-col"> {/* White background for plot container */}
        <h3 className="text-lg font-semibold mb-4 text-[#333333]">Boundary Layer Profile</h3> {/* Dark text */}
        {loading ? (
          <div className="flex items-center justify-center flex-grow"> {/* Used flex-grow to fill available space */}
            <div className="text-[#666666]">Loading data...</div> {/* Medium grey text */}
          </div>
        ) : error ? (
          <div className="flex items-center justify-center flex-grow">
            <div className="text-[#cc0000]">Error loading data: {error}</div> {/* Red error text */}
          </div>
        ) : (
          <div className="relative w-full flex-grow bg-[#e0e0e0] rounded-lg overflow-hidden"> {/* Light grey plot area background */}
            <svg className="w-full h-full" viewBox="0 0 800 600"> {/* Increased viewBox height to 600 for y-range 0-0.4 */}
              {/* Background representing the flow area - fill the plot area */}
              <rect x="50" y="50" width="700" height="500" fill="#ffffff" /> {/* White flow area background, adjusted to plot area */}

              {/* Contour plot (Colored Grid) */}
              {contourType && (() => {
                // Get all 800 points for current nu and uInf for contouring
                const allPointsForContour = getCurrentPoints().contour;

                if (allPointsForContour.length === 0) return null; // Handle case with no contour data

                 // Ensure correct sorting (y then x) if not already guaranteed by getCurrentPoints
                 const sortedPoints = allPointsForContour.sort((a, b) => {
                   if (a.y !== b.y) return a.y - b.y;
                   return a.x - b.x;
                 });

                 const velocityValues = sortedPoints
                   .map(p => contourType === 'u_x' ? p.U_x : p.U_y)
                   .filter(v => typeof v === 'number' && !isNaN(v)); // Filter out invalid values

                 let minVelocity = d3.min(velocityValues);
                 let maxVelocity = d3.max(velocityValues);

                 // Ensure min ≠ max to prevent invalid color scale
                 if (minVelocity === maxVelocity) {
                   minVelocity -= 0.001;
                   maxVelocity += 0.001;
                 }

                 // Clamp U_x to U_inf if needed and adjust U_y range
                 if (contourType === 'u_x') {
                   // Ensure uInf is accessible, maybe from the first point in the case
                   const uInfForClamping = sortedPoints[0]?.u_inf || uInf; // Use value from data or state
                   minVelocity = Math.max(0, minVelocity); // Cap minimum U_x at 0
                   maxVelocity = Math.min(maxVelocity, uInfForClamping); // Cap maximum U_x at U_inf
                 } else if (contourType === 'u_y') {
                   // Use actual min/max from filtered data for U_y
                   // The initial d3.min/max covers this, but we keep this block for clarity if future U_y adjustments are needed
                   console.log('U_y Velocity Data Sample:', velocityValues.slice(0, 20)); // Log sample U_y values
                   console.log('U_y Color Scale Range:', { minVelocity, maxVelocity }); // Log U_y color scale range
                 }

                // Create color scale using the calculated min and max velocity from the data subset
                const colorScale = d3.scaleSequential()
                  .domain([minVelocity, maxVelocity]) // Revert to original domain mapping (dark for less, light for more)
                  .interpolator(d3.interpolateInferno);

                // Define plot area dimensions in pixels
                const plotAreaXMin = 50;
                const plotAreaYMin = 50;
                const plotAreaWidth = 700;
                const plotAreaHeight = 500;

                // Define data grid dimensions and calculate pixel cell size
                const numXGridPoints = 40; 
                const numYGridPoints = 20;
                const rectWidth = plotAreaWidth / numXGridPoints; // Width per cell
                const rectHeight = plotAreaHeight / numYGridPoints; // Height per cell

                // Log min/max velocity and color scale ticks for debugging
                console.log('Contour Color Scale Info:', {
                  minVelocity: minVelocity,
                  maxVelocity: maxVelocity,
                  colorScaleTicks: colorScale.ticks(10) // Log the tick values
                });

                return (
                  <g>
                    {/* Colored grid rectangles */}
                    {/* Iterate through the 800 points and draw a rectangle for each */}
                    {sortedPoints.map((point, i) => {
                        // Calculate the row (j) and column (k) index based on the point's index (i) in the sorted array.
                        const j = Math.floor(i / numXGridPoints); // Row index (0 to 19)
                        const k = i % numXGridPoints;       // Column index (0 to 39)

                        // Skip the bottom row (j = 0)
                        if (j === 0) return null;

                        // Calculate the top-left pixel position of the rectangle based on grid index and data mapping.
                        const rectX = plotAreaXMin + k * rectWidth;
                        const rectY = plotAreaYMin + (plotAreaHeight / (yMaxData - yMinData)) * (yMaxData - point.y);

                        const color = colorScale(contourType === 'u_x' ? point.U_x : point.U_y);

                        return (
                            <rect
                                key={i}
                                x={rectX}
                                y={rectY}
                                width={rectWidth + 0.5}
                                height={rectHeight + 0.5}
                                fill={color}
                            />
                        );
                    }).filter(Boolean)} {/* Filter out null entries from skipped bottom row */}

                    {/* Velocity Profile Arrows and Curves */}
                    {/* Render only if U_x contour is active or no contour is active */}
                    {(() => {
                      if (!sortedPoints || sortedPoints.length === 0 || nu === null || uInf === null) return null; // Ensure data and parameters are loaded

                      const targetXValues = [1.0, 2.5, 4.0]; // Target x-locations for profiles
                      const epsilonX = (xMaxData - xMinData) / (numXGridPoints * 2); // Tolerance for finding closest x-value in data

                      return (
                        <g>
                          {/* Define arrowhead marker */}
                          {/* Defined once outside the map */}
                          <marker
                            id="profileArrowhead"
                            viewBox="0 -5 10 10"
                            refX="10"
                            refY="0"
                            markerWidth="5"
                            markerHeight="5"
                            orient="auto"
                          >
                            <path d="M0,-5L10,0L0,5Z" fill="#ff3333" /> {/* Brighter red arrowhead */}
                          </marker>

                          {targetXValues.map((targetX) => {
                            // Calculate boundary layer height delta at this target x
                            const delta99_calculated = (uInf > 1e-9 && targetX >= xMinData) ? (4.92 * Math.sqrt((nu * targetX) / uInf)) : 0; // Ensure uInf > 0 and targetX >= xMinData

                            // Find points in the data at the target x-location and within the boundary layer height
                            const profilePoints = sortedPoints.filter(point => 
                                Math.abs(point.x - targetX) < epsilonX && // Points at the target x
                                point.y <= delta99_calculated // Points within the boundary layer height
                            );

                            if (profilePoints.length === 0) {
                              console.log(`No points found near x = ${targetX} within boundary layer`);
                              return null;
                            }

                            // Sort points by y for drawing the profile line correctly
                            profilePoints.sort((a, b) => a.y - b.y);

                            // Scale factor for the horizontal velocity line length
                            // Scale U_x values (0 to uInf) to a reasonable pixel length on the plot
                            const maxPossibleUx = uInf; // Maximum expected U_x is U_inf outside the BL
                            const uxScale = maxPossibleUx > 0 ? (plotAreaWidth / 5.0) / maxPossibleUx : 0; // Scale Ux so U_inf roughly spans 1/5th of the width
                            const minLineLength = 1; // Minimum pixel length for visibility of small velocities

                            // Calculate horizontal velocity lines and profile curve points
                            const horizontalLines = profilePoints.map((point, pIndex) => {
                              // Point location in SVG coordinates (start of the horizontal line)
                              const startX = plotAreaXMin + (point.x - xMinData) / (xMaxData - xMinData) * plotAreaWidth;
                              const startY = plotAreaYMin + (yMaxData - point.y) / (yMaxData - yMinData) * plotAreaHeight; // Inverted Y

                              // Scaled horizontal velocity magnitude (U_x)
                              const scaledUx = point.U_x * uxScale;
                              const finalLineLength = Math.max(minLineLength, scaledUx); // Ensure minimum length

                              // End point of the horizontal line in SVG coordinates
                              const endX = startX + finalLineLength;
                              const endY = startY; // Horizontal line

                              // Use a unique key for each line element
                              const lineKey = `hline-${targetX}-${pIndex}`; // Unique key for each line

                              return (
                                <line
                                  key={lineKey}
                                  x1={startX}
                                  y1={startY}
                                  x2={endX}
                                  y2={endY}
                                  stroke="#ff3333" // Brighter red horizontal line
                                  strokeWidth="2" // Made slightly thicker for better visibility
                                  markerEnd="url(#profileArrowhead)" // Add arrowhead at the end
                                />
                              );
                            });

                            // Calculate points for the profile curve (using end points of horizontal lines)
                            const profileCurvePoints = profilePoints.map((point) => {
                                // Point location in SVG coordinates (start of the horizontal line)
                                const startX = plotAreaXMin + (point.x - xMinData) / (xMaxData - xMinData) * plotAreaWidth;
                                const startY = plotAreaYMin + (yMaxData - point.y) / (yMaxData - yMinData) * plotAreaHeight; // Inverted Y

                                // Scaled horizontal velocity magnitude (U_x)
                                const scaledUx = point.U_x * uxScale;
                                const finalLineLength = Math.max(minLineLength, scaledUx); // Ensure minimum length

                                // End point of the horizontal line in SVG coordinates
                                const endX = startX + finalLineLength;
                                const endY = startY; // Horizontal line
                                
                                return [endX, endY];
                            });

                            // Generate the path data for the profile curve
                            // Add the starting point at y=0 for this x-location (velocity = 0)
                            const startProfilePoint = [
                                plotAreaXMin + (targetX - xMinData) / (xMaxData - xMinData) * plotAreaWidth,
                                plotAreaYMin + (yMaxData - 0) / (yMaxData - yMinData) * plotAreaHeight
                            ];

                            // Combine the start point with the calculated profile curve points
                            const profileLinePoints = [startProfilePoint, ...profileCurvePoints];

                            // Use a smooth curve generator
                            const smoothLine = d3.line()
                                .curve(d3.curveCardinal); // Use Cardinal spline for smoothing

                            // Only draw line if there are enough points (at least 2)
                            const profileLine = profileLinePoints.length > 1 ? smoothLine(profileLinePoints) : null; 

                            return (
                                <g key={`profileGroup-${targetX}`}> {/* Unique key for the group */}
                                    {horizontalLines} {/* Draw the horizontal velocity lines with arrowheads */}
                                    {profileLine && (
                                        <path
                                            d={profileLine}
                                            fill="none"
                                            stroke="#ff3333" // Brighter red profile line
                                            strokeWidth="2" // Made slightly thicker for better visibility
                                        />
                                    )} {/* Draw the smoothed profile curve */}
                                     {/* Optional: Mark the boundary layer height with a horizontal dashed line */}
                                     {/* {delta99_calculated > 0 && delta99_calculated <= yMaxData && targetX >= xMinData && (
                                        <line
                                            x1={plotAreaXMin + (targetX - xMinData) / (xMaxData - xMinData) * plotAreaWidth - 10} // Short line to the left
                                            y1={plotAreaYMin + (yMaxData - delta99_calculated) / (yMaxData - yMinData) * plotAreaHeight}
                                            x2={plotAreaXMin + (targetX - xMinData) / (xMaxData - xMinData) * plotAreaWidth + 10} // Short line to the right
                                            y2={plotAreaYMin + (yMaxData - delta99_calculated) / (yMaxData - yMinData) * plotAreaHeight}
                                            stroke="#ff7f0e" // Orange marker
                                            strokeWidth="2"
                                            strokeDasharray="4 4"
                                        />
                                    )} */}
                                </g>
                            );
                          })}
                        </g>
                      );
                    })()}

                    {/* Color bar */}
                    <g transform="translate(760, 50)">
                      {/* Color bar gradient */}
                      <defs>
                        <linearGradient id="colorGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          {[0, 0.2, 0.4, 0.6, 0.8, 1].map((t, i) => (
                            <stop
                              key={i}
                              offset={`${t * 100}%`}
                              stopColor={colorScale(minVelocity + t * (maxVelocity - minVelocity))}
                            />
                          ))}
                        </linearGradient>
                      </defs>
                      
                      {/* Color bar rectangle */}
                      <rect
                        x="0"
                        y="0"
                        width="20"
                        height="500"
                        fill="url(#colorGradient)"
                      />

                      {/* Color bar labels */}
                      {colorScale.ticks(10).map((tick, i) => { // Increased ticks to 10 for more detail
                         // Position ticks evenly on the color bar height (500)
                         // Map tick value to a 0-1 range based on min/max velocity
                         // Use the actual minVelocity and maxVelocity from the data for accurate mapping
                         const t = (tick - minVelocity) / (maxVelocity - minVelocity);
                         // Invert y for linear gradient from top (0) to bottom (1) of the color bar height
                         const yPos = 500 * (1 - t);

                         // Only render labels within the color bar height range
                         if (yPos < 0 || yPos > 500) return null; 

                         // Calculate the swapped value to display on the color bar
                         const swappedTickValue = minVelocity + maxVelocity - tick;

                        return (
                          <text
                            key={i}
                            x="25"
                            y={yPos}
                            className="text-xs fill-[#333333]"
                            dominantBaseline="middle" // Keep middle baseline
                          >
                            {swappedTickValue.toFixed(3)} // Display the swapped value
                          </text>
                        );
                      })}
                    </g>
                  </g>
                );
              })()}              

              {/* X-axis grid lines and labels */}
              {[0.01, 1, 2, 3, 4, 5].map((x, i) => (
                <g key={`x-${i}`}>
                  <text
                    x={50 + ((x - xMinData) / (xMaxData - xMinData)) * 700}
                    y="570"
                    className="text-xs fill-[#333333]"
                    textAnchor="middle"
                  >
                    {x}
                  </text>
                </g>
              ))}

              {/* Y-axis grid lines and labels */}
               {/* Removed grid lines as requested */}
              {[0, 0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40].map((y, i) => (
                <g key={`y-${i}`}>
                   {/* <line
                    x1="50"
                    y1={550 - (y / 0.4) * 500}
                    x2="750"
                    y2={550 - (y / 0.4) * 500}
                    stroke="#cccccc" // Light grey grid lines
                    strokeWidth="1"
                  /> */}
                  <text
                    x="45"
                    y={550 - (y / 0.4) * 500}
                    className="text-xs fill-[#333333]" // Dark axis labels
                    textAnchor="end"
                    dominantBaseline="middle"
                  >
                    {y.toFixed(2)}
                  </text>
                </g>
              ))}

              {/* Boundary layer profile */}
              {(() => {
                const points = getCurrentPoints().boundaryLayer;
                if (points.length === 0) {
                  return (
                    <text
                      x="400"
                      y="300" // Center vertically in new height (600/2) - adjusted
                      textAnchor="middle"
                      className="fill-[#cc0000] text-lg" // Red text
                    >
                      No data found for selected parameters below x=0.5
                    </text>
                  );
                }

                const pathData = points.map((point, index) => {
                  // Scale x from 0.5-5 to 50-750 (leaving space for Y axis labels)
                  // Ensure point.x >= 0.5 before scaling
                  if (point.x < 0.5) return null; // Skip points before 0.5 for plotting
                  const x = 50 + ((point.x - 0.5) / 4.5) * 700;
                  // Scale y (delta99) from 0-0.4 to 550-50 (relative to plate and leaving space at top)
                  const y = 550 - (point.delta99 / 0.4) * 500; // Adjusted scaling
                  return `${index === 0 || points[index -1]?.x < 0.5 ? 'M' : 'L'} ${x} ${y}`;
                }).filter(d => d !== null).join(' '); // Filter out null entries and join

                // Handle case where all points are < 0.5
                if (!pathData) {
                   return (
                    <text
                      x="400"
                      y="300" // Center vertically in new height
                      textAnchor="middle"
                      className="fill-[#cc0000] text-lg" // Red text
                    >
                      No data found for selected parameters below x=0.5
                    </text>
                  );
                }

                return (
                  <path
                    d={pathData}
                    fill="none"
                    stroke="#007bff" // Blue boundary layer line
                    strokeWidth="2"
                  />
                );
              })()}              

              {/* Axis labels */}
              <text x="400" y="590" className="text-sm fill-[#333333]" textAnchor="middle">x (m)</text> {/* Dark X-axis label */}
              <text
                x="20" // Position further left for y-axis label - adjusted x position slightly
                y="300" // Center vertically
                className="text-sm fill-[#333333]" // Dark Y-axis label
                textAnchor="middle"
                transform="rotate(-90, 20, 300)" // Adjusted rotation point
              >
                δ (m)
              </text>

            </svg>
          </div>
        )}
      </div> {/* End of plot section */}

      {/* Controls section takes full width on small screens, 1/3 on medium+ */}
      <div className="w-full md:w-1/3 bg-[#ffffff] p-6 rounded-xl shadow-md"> {/* White background for controls container */}
        <h3 className="text-lg font-semibold mb-4 text-[#333333]">Simulation Controls</h3> {/* Dark text */}
        {/* Render controls only after data and initial values are loaded */}
        {!loading && nuValues.length > 0 && uInfValues.length > 0 && nu !== null && uInf !== null && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-[#333333] mb-2"> {/* Dark label text */}
                Dynamic Viscosity (ν)
              </label>
              <input
                type="range"
                min="0"
                max={nuValues.length - 1}
                step="1"
                value={nuValues.indexOf(nu)}
                onChange={(e) => setNu(nuValues[parseInt(e.target.value)])}
                className="w-full custom-light-slider" // Changed custom class
              />
              <div className="mt-2 text-sm text-[#007bff]"> {/* Blue current value text */}
                Current ν: {nu.toExponential(4)} m²/s
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#333333] mb-2"> {/* Dark label text */}
                Free Stream Velocity (U∞)
              </label>
              <input
                type="range"
                min="0"
                max={uInfValues.length - 1}
                step="1"
                value={uInfValues.indexOf(uInf)}
                onChange={(e) => setUInf(uInfValues[parseInt(e.target.value)])}
                className="w-full custom-light-slider" // Changed custom class
              />
              <div className="mt-2 text-sm text-[#007bff]"> {/* Blue current value text */}
                Current U∞: {uInf.toFixed(4)} m/s
              </div>
            </div>

            <div className="pt-2 border-t border-[#cccccc]"> {/* Light grey border */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setContourType(contourType === 'u_x' ? null : 'u_x')}
                  className={`px-4 py-2 rounded ${contourType === 'u_x' ? 'bg-[#007bff] text-white' : 'bg-[#e0e0e0] text-[#333333]'}`} // Blue active, light grey inactive button
                >
                  U_x Contour
                </button>
                <button
                  onClick={() => setContourType(contourType === 'u_y' ? null : 'u_y')}
                  className={`px-4 py-2 rounded ${contourType === 'u_y' ? 'bg-[#007bff] text-white' : 'bg-[#e0e0e0] text-[#333333]'}`} // Blue active, light grey inactive button
                >
                  U_y Contour
                </button>
              </div>
              <div className="text-sm text-[#333333]"> {/* Dark Reynolds number text */}
                Reynolds Number (Re): {currentRe !== 'N/A' ? currentRe.toExponential(2) : 'N/A'}
              </div>
            </div>
          </div>
        )}
      </div> {/* End of controls section */}
    </div>
  );
}

function HomePage({ onSelectSimulation }) {
  return (
    <div className="p-8 bg-[#f0f0f0] min-h-screen text-[#333333]"> {/* Light grey background and dark text for Home page */}
      <h1 className="text-4xl font-bold mb-8">Heat Transfer Simulations</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div 
          className="bg-[#ffffff] rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
          onClick={() => onSelectSimulation('boundary-layer')}
        >
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-2 text-[#007bff]">Boundary Layer Analysis</h2> {/* Blue title */}
            <p className="text-[#333333] mb-4">Interactive visualization of boundary layer development with adjustable parameters.</p> {/* Dark text */}
            <div className="flex items-center text-[#007bff]"> {/* Blue link text */}
              <span className="font-medium">Click to View</span>
              <span className="ml-2 w-2 h-2 bg-[#007bff] rounded-full"></span> {/* Blue dot */}
            </div>
          </div>
        </div>
        
        <div className="bg-[#e0e0e0] rounded-xl shadow-md overflow-hidden opacity-50"> {/* Disabled card with light grey background */}
          <div className="p-6 text-[#666666]"> {/* Medium grey text */}
            <h2 className="text-xl font-semibold mb-2">Coming Soon</h2>
            <p className="mb-4">More heat transfer simulations will be available soon.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [activeSimulation, setActiveSimulation] = useState(null);

  useEffect(() => {
    const handlePopstate = () => {
      setActiveSimulation(null); // Go back to home on browser back
    };

    window.addEventListener('popstate', handlePopstate);

    return () => {
      window.removeEventListener('popstate', handlePopstate);
    };
  }, []);

  const handleSelectSimulation = (simulation) => {
    setActiveSimulation(simulation);
    window.history.pushState({ simulation: simulation }, '', `/${simulation}`); // Push state for browser history
  };

  return (
    <div className="min-h-screen bg-[#f0f0f0]"> {/* Main app container with light grey background */}
      {activeSimulation === 'boundary-layer' ? (
        <BoundaryLayerSimulation onBack={() => window.history.back()} /> // Use history.back for going back
      ) : (
        <HomePage onSelectSimulation={handleSelectSimulation} />
      )}
    </div>
  );
}

export default App;