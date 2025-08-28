import React, { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";
import { stringToColor } from "../../common/string-to-color";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { useWindowSize } from "usehooks-ts";

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

// Fixed physics parameters (no longer state, just constants)
const physicsParams = {
  nodeRepulsion: -260,
  linkDistance: 200,
  linkStrength: 0.15,
  collisionPadding: 15,
  centeringStrength: 0.02,
};

export const PlayerNetwork: React.FC = () => {
  const context = useEventDbContext();
  const { height } = useWindowSize();
  const svgRef = useRef<SVGSVGElement>(null);
  const [matches] = useState<Match[]>(
    context.games
      .filter(
        (g) =>
          context.eventStore.playersProjector.getPlayer(g.winner)?.active &&
          context.eventStore.playersProjector.getPlayer(g.loser)?.active,
      )
      .map((g) => ({ player1: g.winner, player2: g.loser, winner: g.winner })),
  );
  const simulationRef = useRef<d3.Simulation<Node, Link> | null>(null);

  // Connection threshold slider
  const [connectionThreshold, setConnectionThreshold] = useState(15);

  const processMatches = useCallback(
    (threshold: number = 15) => {
      const playerStats = new Map<string, { matches: number; wins: number }>();
      const connections = new Map<string, Match[]>();

      matches.forEach((match) => {
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
    },
    [matches],
  );

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

        // Create simulation with fixed physics
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
        .attr("stroke", "rgb(var(--color-secondary-background))")
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
        // .attr("stroke", "#fff")
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
        .attr("fill", "#ffffff")
        .attr("stroke", "#000000")
        .attr("stroke-width", 2)
        .attr("paint-order", "stroke fill")
        .attr("opacity", isInitial ? 1 : 0)
        .style("pointer-events", "none");

      const labelMerged = labelSelection.merge(labelEnter);

      labelMerged
        .text((d) => context.playerName(d.id))
        .attr("font-size", (d) => {
          const chars = context.playerName(d.id).length;
          return `${Math.max(12, (d.radius * 3.14) / Math.max(5, chars))}px`;
        });

      if (!isInitial) {
        labelMerged.transition().duration(300).attr("opacity", 1);
      }

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
    [context],
  );

  // Update visualization live
  useEffect(() => {
    const { nodes, links } = processMatches(connectionThreshold);
    createVisualization(nodes, links, false);
  }, [connectionThreshold, matches, processMatches, createVisualization]);

  // Initialize visualization
  useEffect(() => {
    const { nodes, links } = processMatches(connectionThreshold);
    createVisualization(nodes, links, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-full ">
      {/* Connection Threshold Slider */}
      <div className="px-4 py-2 bg-secondary-background text-secondary-text rounded-lg">
        <h3 className="text-lg font-semibold">Games per link</h3>
        <input
          type="range"
          min="1"
          max="50"
          value={connectionThreshold}
          onChange={(e) => setConnectionThreshold(Number(e.target.value))}
          className="w-full h-3 bg-secondary-text rounded-lg appearance-none cursor-pointer slider-blue"
          disabled={matches.length === 0}
        />
        <div className="flex justify-between text-xs text-secondary-text">
          <span>1 game per link</span>
          <span>Many games per link</span>
        </div>
      </div>
      <div className="border rounded-lg bg-gray-50">
        <svg
          ref={svgRef}
          className="w-full border rounded"
          style={{ height: height - 170 + "px", background: "rgb(var(--color-primary-background))" }}
        />
      </div>
    </div>
  );
};
