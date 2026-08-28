/** Static ASCII renderers for coding-problem inputs. Deterministic, universal fallback. */

export function renderArray(values: Array<number | string | null>): string {
  const cells = values.map((v) => ` ${v === null ? "·" : String(v)} `);
  const indexRow = values.map((_, i) => String(i).padStart(cells[i].length, " ")).join(" ");
  return `[${cells.join("|")}]\n ${indexRow}`;
}

export function renderLinkedList(values: Array<number | string>): string {
  if (values.length === 0) return "(empty list)";
  return values.map((v) => `[${v}]`).join("→") + "→∅";
}

/** Level-order (null-padded) tree → 2-D ASCII. Good up to ~4 levels; falls back to level list. */
export function renderTree(values: Array<number | null>): string {
  if (values.length === 0 || values[0] === null) return "(empty tree)";
  interface Node { val: number; left?: Node; right?: Node }
  const nodes = values.map((v) => (v === null ? undefined : ({ val: v } as Node)));
  const kids = [...nodes].reverse();
  const root = kids.pop()!;
  for (const node of nodes) {
    if (node) {
      if (kids.length) node.left = kids.pop();
      if (kids.length) node.right = kids.pop();
    }
  }
  const depth = (n?: Node): number => (n ? 1 + Math.max(depth(n.left), depth(n.right)) : 0);
  const d = depth(root);
  if (d > 4) {
    // too wide for clean ASCII; show by level
    const lines: string[] = [];
    let level: Array<Node | undefined> = [root];
    while (level.some(Boolean)) {
      lines.push(level.map((n) => (n ? String(n.val) : "·")).join(" "));
      level = level.flatMap((n) => (n ? [n.left, n.right] : []));
    }
    return lines.join("\n");
  }
  // slot-based layout: complete-tree positions on a 2^(d)-wide grid
  const width = 2 ** d * 2;
  const lines: string[] = [];
  let level: Array<{ node?: Node; pos: number }> = [{ node: root, pos: width / 2 }];
  for (let row = 0; row < d; row++) {
    const chars = Array(width).fill(" ");
    const branch = Array(width).fill(" ");
    const next: typeof level = [];
    const offset = width / 2 ** (row + 2);
    for (const { node, pos } of level) {
      if (!node) continue;
      const label = String(node.val);
      const start = Math.max(0, pos - Math.floor(label.length / 2));
      for (let i = 0; i < label.length && start + i < width; i++) chars[start + i] = label[i];
      if (node.left) {
        branch[pos - Math.ceil(offset / 2)] = "/";
        next.push({ node: node.left, pos: pos - offset });
      }
      if (node.right) {
        branch[pos + Math.ceil(offset / 2)] = "\\";
        next.push({ node: node.right, pos: pos + offset });
      }
    }
    lines.push(chars.join("").trimEnd());
    if (next.length) lines.push(branch.join("").trimEnd());
    level = next;
  }
  return lines.filter((l) => l.length).join("\n");
}
