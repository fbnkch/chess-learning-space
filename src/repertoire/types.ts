export type Side = "white" | "black";
export interface IdeaArrow {
  from: string;
  to: string;
  color: "G" | "R" | "B" | "Y";
}
export interface Edge {
  arrows: IdeaArrow[];
  uci: string;
  to: string;
  kind: "ours" | "reply";
  comment: string;
  ruleIds: string[];
  weight: number;
}
export interface Line {
  main?: boolean;
  id: string;
  name: string;
  group: string;
  summary: string;
  startFen: string;
  moves: string[];
  weight: number;
}
export interface Graph {
  side: Side;
  contentVersion: string;
  nodes: Record<
    string,
    { fen: string; edges: Edge[]; lines: { lineId: string; ply: number }[] }
  >;
  lines: Line[];
}
export interface Card {
  id: string;
  kind: "repertoire" | "mistake" | "puzzle" | "rule";
  side?: Side;
}
export interface RepertoireCard extends Card {
  kind: "repertoire";
  side: Side;
  positionKey: string;
  lineId: string;
}
