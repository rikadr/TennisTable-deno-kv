import React, { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";
import { stringToColor } from "../../common/string-to-color";
import { useEventDbContext } from "../../wrappers/event-db-context";

interface Match {
  player1: string;
  player2: string;
  winner?: string;
}

interface Node extends d3.SimulationNodeDatum {
  id: string;
  matches: number;
  wins: number;
  radius: number;
}

interface Link extends d3.SimulationLinkDatum<Node> {
  source: Node;
  target: Node;
  strength: number;
  matches: Match[];
}

export const PlayerNetwork: React.FC = () => {
  const context = useEventDbContext();
  const svgRef = useRef<SVGSVGElement>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const simulationRef = useRef<d3.Simulation<Node, Link> | null>(null);

  // Connection threshold slider
  const [connectionThreshold, setConnectionThreshold] = useState(15);

  // Physics parameters with sliders
  const [physicsParams, setPhysicsParams] = useState({
    nodeRepulsion: -800,
    linkDistance: 150,
    linkStrength: 0.15,
    collisionPadding: 15,
    centeringStrength: 0.005,
  });

  const processMatches = useCallback((matchData: Match[], threshold: number = 15) => {
    const playerStats = new Map<string, { matches: number; wins: number }>();
    const connections = new Map<string, Match[]>();

    matchData.forEach((match) => {
      const { player1, player2, winner } = match;

      // Update player stats
      if (!playerStats.has(player1)) {
        playerStats.set(player1, { matches: 0, wins: 0 });
      }
      if (!playerStats.has(player2)) {
        playerStats.set(player2, { matches: 0, wins: 0 });
      }

      const p1Stats = playerStats.get(player1)!;
      const p2Stats = playerStats.get(player2)!;

      p1Stats.matches++;
      p2Stats.matches++;

      if (winner === player1) p1Stats.wins++;
      if (winner === player2) p2Stats.wins++;

      // Track connections
      const connectionKey = [player1, player2].sort().join("-");
      if (!connections.has(connectionKey)) {
        connections.set(connectionKey, []);
      }
      connections.get(connectionKey)!.push(match);
    });

    // Create nodes
    const nodes: Node[] = Array.from(playerStats.entries()).map(([id, stats]) => ({
      id,
      matches: stats.matches,
      wins: stats.wins,
      radius: Math.max(8, Math.sqrt(stats.matches) * 4),
    }));

    // Create links - only for pairings with threshold or more matches
    const links: Link[] = Array.from(connections.entries())
      .filter(([key, matchList]) => matchList.length >= threshold)
      .map(([key, matchList]) => {
        const [player1, player2] = key.split("-");
        const source = nodes.find((n) => n.id === player1)!;
        const target = nodes.find((n) => n.id === player2)!;

        return {
          source,
          target,
          strength: matchList.length,
          matches: matchList,
        };
      });

    return { nodes, links };
  }, []);

  const createVisualization = useCallback(
    (nodes: Node[], links: Link[], isInitial: boolean = false) => {
      const svgElement = d3.select(svgRef.current);

      if (isInitial) {
        svgElement.selectAll("*").remove();
      }

      const width = 800;
      const height = 600;

      if (isInitial) {
        svgElement.attr("width", width).attr("height", height);

        const g = svgElement.append("g");

        // Add zoom behavior
        const zoom = d3
          .zoom<SVGSVGElement, unknown>()
          .scaleExtent([0.1, 4])
          .on("zoom", (event) => {
            g.attr("transform", event.transform);
          });

        (svgElement as d3.Selection<SVGSVGElement, unknown, null, undefined>).call(zoom);

        // Create simulation with adjustable physics
        const simulation = d3
          .forceSimulation<Node>(nodes)
          .force(
            "link",
            d3
              .forceLink<Node, Link>(links)
              .id((d) => d.id)
              .distance((d) => {
                const strengthFactor = Math.max(0.4, 1 - d.strength * 0.05);
                return physicsParams.linkDistance * strengthFactor;
              })
              .strength(physicsParams.linkStrength),
          )
          .force("charge", d3.forceManyBody().strength(physicsParams.nodeRepulsion).distanceMin(50).distanceMax(600))
          .force("center", d3.forceCenter(width / 2, height / 2))
          .force(
            "collision",
            d3
              .forceCollide()
              .radius((d) => (d as Node).radius + physicsParams.collisionPadding)
              .strength(1),
          )
          .force("x", d3.forceX(width / 2).strength(physicsParams.centeringStrength))
          .force("y", d3.forceY(height / 2).strength(physicsParams.centeringStrength))
          .alpha(1)
          .alphaDecay(0.01)
          .velocityDecay(0.6);

        simulationRef.current = simulation;

        // Initial empty groups
        g.append("g").attr("class", "links");
        g.append("g").attr("class", "nodes");
        g.append("g").attr("class", "labels");
      }

      if (!simulationRef.current) return;

      const simulation = simulationRef.current;
      const g = svgElement.select("g");

      // Preserve existing positions
      if (!isInitial) {
        const existingNodes = new Map(simulation.nodes().map((d) => [d.id, { x: d.x, y: d.y }]));
        nodes.forEach((node) => {
          const existing = existingNodes.get(node.id);
          if (existing) {
            node.x = existing.x;
            node.y = existing.y;
            node.vx = 0;
            node.vy = 0;
          }
        });
      }

      // Update simulation
      simulation.nodes(nodes);
      simulation.force<d3.ForceLink<Node, Link>>("link")?.links(links);

      // Update links
      const linkSelection = g
        .select(".links")
        .selectAll<SVGLineElement, Link>("line")
        .data(links, (d: any) => `${d.source.id}-${d.target.id}`);

      linkSelection.exit().remove();

      const linkEnter = linkSelection
        .enter()
        .append("line")
        .attr("stroke", "#999")
        .attr("stroke-opacity", 0)
        .attr("stroke-width", 0);

      linkEnter.append("title");

      const linkMerged = linkSelection.merge(linkEnter);

      if (isInitial) {
        linkMerged
          .attr("stroke-opacity", (d) => Math.min(0.8, 0.3 + d.strength * 0.1))
          .attr("stroke-width", (d) => Math.min(6, Math.sqrt(d.strength) + 1));
      } else {
        linkMerged
          .transition()
          .duration(300)
          .attr("stroke-opacity", (d) => Math.min(0.8, 0.3 + d.strength * 0.1))
          .attr("stroke-width", (d) => Math.min(6, Math.sqrt(d.strength) + 1));
      }

      // Update nodes
      const nodeSelection = g
        .select(".nodes")
        .selectAll<SVGCircleElement, Node>("circle")
        .data(nodes, (d: any) => d.id);

      nodeSelection.exit().remove();

      const nodeEnter = nodeSelection
        .enter()
        .append("circle")
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.5)
        .attr("r", isInitial ? (d: Node) => d.radius : 0)
        .attr("fill", "#ccc");

      nodeEnter.append("title");

      // Add drag behavior
      const drag = d3
        .drag<SVGCircleElement, Node>()
        .on("start", (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        });

      nodeEnter.call(drag);

      const nodeMerged = nodeSelection.merge(nodeEnter);

      if (isInitial) {
        nodeMerged.attr("r", (d) => d.radius).attr("fill", (d) => stringToColor(d.id) || "#999");
      } else {
        nodeMerged
          .transition()
          .duration(300)
          .attr("r", (d) => d.radius)
          .attr("fill", (d) => stringToColor(d.id) || "#999");
      }

      // Update labels
      const labelSelection = g
        .select(".labels")
        .selectAll<SVGTextElement, Node>("text")
        .data(nodes, (d: any) => d.id);

      labelSelection.exit().remove();

      const labelEnter = labelSelection
        .enter()
        .append("text")
        .attr("font-family", "Arial, sans-serif")
        .attr("font-weight", "500")
        .attr("text-anchor", "middle")
        .attr("dy", "0.3em")
        .attr("fill", "#2d3748")
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.5)
        .attr("paint-order", "stroke fill")
        .attr("opacity", isInitial ? 1 : 0);

      const labelMerged = labelSelection.merge(labelEnter);

      labelMerged
        .text((d) => context.playerName(d.id))
        .attr("font-size", (d) => `${Math.max(10, Math.min(14, 8 + d.radius * 0.3))}px`);

      if (!isInitial) {
        labelMerged.transition().duration(300).attr("opacity", 1);
      }

      nodeMerged
        .select("title")
        .text(
          (d) =>
            `${d.id}\nMatches: ${d.matches}\nWins: ${d.wins}\nWin Rate: ${((d.wins / d.matches) * 100).toFixed(1)}%`,
        );

      // Update positions on simulation tick
      simulation.on("tick", () => {
        linkMerged
          .attr("x1", (d) => (d.source as Node).x!)
          .attr("y1", (d) => (d.source as Node).y!)
          .attr("x2", (d) => (d.target as Node).x!)
          .attr("y2", (d) => (d.target as Node).y!);

        nodeMerged.attr("cx", (d) => d.x!).attr("cy", (d) => d.y!);

        labelMerged.attr("x", (d) => d.x!).attr("y", (d) => d.y!);
      });

      // Restart simulation gently
      simulation.alpha(isInitial ? 1 : 0.1).restart();
    },
    [physicsParams, context],
  );

  // Update visualization when threshold changes
  useEffect(() => {
    if (matches.length > 0) {
      const { nodes, links } = processMatches(matches, connectionThreshold);
      createVisualization(nodes, links, false);
    }
  }, [connectionThreshold, matches, processMatches, createVisualization]);

  // Update physics when parameters change
  useEffect(() => {
    if (simulationRef.current) {
      const simulation = simulationRef.current;
      const width = 800;
      const height = 600;

      // Update existing forces with new parameters
      simulation
        .force("charge", d3.forceManyBody().strength(physicsParams.nodeRepulsion).distanceMin(50).distanceMax(600))
        .force(
          "collision",
          d3
            .forceCollide()
            .radius((d) => (d as Node).radius + physicsParams.collisionPadding)
            .strength(1),
        )
        .force("x", d3.forceX(width / 2).strength(physicsParams.centeringStrength))
        .force("y", d3.forceY(height / 2).strength(physicsParams.centeringStrength));

      // Update link force if it exists
      const linkForce = simulation.force<d3.ForceLink<Node, Link>>("link");
      if (linkForce) {
        linkForce
          .distance((d) => {
            const strengthFactor = Math.max(0.4, 1 - d.strength * 0.05);
            return physicsParams.linkDistance * strengthFactor;
          })
          .strength(physicsParams.linkStrength);
      }

      // Restart simulation with new parameters
      simulation.alpha(0.3).restart();
    }
  }, [physicsParams]);

  const loadAllMatches = () => {
    setIsLoading(true);
    const allMatches = context.games.map((g) => ({ player1: g.winner, player2: g.loser, winner: g.winner }));
    setMatches(allMatches);

    const { nodes, links } = processMatches(allMatches, connectionThreshold);
    createVisualization(nodes, links, true);

    setIsLoading(false);
  };

  const updatePhysicsParam = (param: keyof typeof physicsParams, value: number) => {
    setPhysicsParams((prev) => ({ ...prev, [param]: value }));
  };

  const resetPhysicsToDefaults = () => {
    setPhysicsParams({
      nodeRepulsion: -800,
      linkDistance: 150,
      linkStrength: 0.15,
      collisionPadding: 15,
      centeringStrength: 0.005,
    });
  };

  const handleLoadSampleData = () => {
    loadAllMatches();
  };

  const handleClearData = () => {
    setMatches([]);
    if (simulationRef.current) {
      simulationRef.current.stop();
      simulationRef.current = null;
    }
    d3.select(svgRef.current).selectAll("*").remove();
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">Table Tennis Network Map</h1>
        <p className="text-gray-600 mb-4">
          Visualize the network of table tennis matches. Use the connection threshold slider to filter relationships.
          Node size represents total matches played, each player has their own unique color, and link thickness shows
          match frequency.
        </p>

        <div className="flex gap-4 mb-4">
          <button
            onClick={handleLoadSampleData}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {isLoading ? "Loading..." : "Load Sample Data"}
          </button>

          <button
            onClick={handleClearData}
            disabled={isLoading}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
          >
            Clear
          </button>

          <button
            onClick={resetPhysicsToDefaults}
            disabled={isLoading}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
          >
            Reset Physics
          </button>
        </div>

        {/* Physics Control Sliders */}
        <div className="mb-4 p-4 bg-gray-50 rounded-lg border">
          <h3 className="text-lg font-semibold mb-3 text-gray-800">Physics Controls</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Node Repulsion: {physicsParams.nodeRepulsion}
              </label>
              <input
                type="range"
                min="-2000"
                max="-100"
                value={physicsParams.nodeRepulsion}
                onChange={(e) => updatePhysicsParam("nodeRepulsion", Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="text-xs text-gray-500">Higher = more spread out</div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Link Distance: {physicsParams.linkDistance}
              </label>
              <input
                type="range"
                min="50"
                max="300"
                value={physicsParams.linkDistance}
                onChange={(e) => updatePhysicsParam("linkDistance", Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="text-xs text-gray-500">Higher = longer connections</div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Link Strength: {physicsParams.linkStrength.toFixed(3)}
              </label>
              <input
                type="range"
                min="0.01"
                max="1"
                step="0.01"
                value={physicsParams.linkStrength}
                onChange={(e) => updatePhysicsParam("linkStrength", Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="text-xs text-gray-500">Higher = stronger pull</div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Node Padding: {physicsParams.collisionPadding}
              </label>
              <input
                type="range"
                min="0"
                max="50"
                value={physicsParams.collisionPadding}
                onChange={(e) => updatePhysicsParam("collisionPadding", Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="text-xs text-gray-500">Higher = more spacing</div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Centering: {physicsParams.centeringStrength.toFixed(4)}
              </label>
              <input
                type="range"
                min="0"
                max="0.1"
                step="0.001"
                value={physicsParams.centeringStrength}
                onChange={(e) => updatePhysicsParam("centeringStrength", Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="text-xs text-gray-500">Higher = pulled to center</div>
            </div>
          </div>
        </div>
        {/* Connection Threshold Slider */}
        <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="text-lg font-semibold mb-3 text-blue-800">Games per link</h3>
          <div className="space-y-2">
            <input
              type="range"
              min="1"
              max="50"
              value={connectionThreshold}
              onChange={(e) => setConnectionThreshold(Number(e.target.value))}
              className="w-full h-3 bg-blue-200 rounded-lg appearance-none cursor-pointer slider-blue"
              disabled={matches.length === 0}
            />
            <div className="flex justify-between text-xs text-blue-600">
              <span>One matches per link</span>
              <span>Many matches per link</span>
            </div>
          </div>
        </div>
      </div>

      <div className="border rounded-lg bg-gray-50 p-4">
        <svg ref={svgRef} className="w-full border rounded" style={{ minHeight: "600px", background: "white" }} />
      </div>

      <div className="mt-4 text-sm text-gray-600">
        <p>
          <strong>Instructions:</strong>
        </p>
        <ul className="list-disc list-inside space-y-1">
          <li>Drag nodes to reposition them</li>
          <li>Scroll to zoom in/out</li>
          <li>Hover over nodes and links for details</li>
          <li>Node size: Larger = more matches played</li>
          <li>Link thickness: Thicker = more matches between players</li>
        </ul>
      </div>
    </div>
  );
};
