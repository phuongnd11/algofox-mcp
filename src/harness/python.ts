import type { CodingProblem } from "../content/problemSchema.js";

/** Static Python test runner. Reads tests.json + .algofox-meta.json; stdlib only. */
const RUNNER = `#!/usr/bin/env python3
"""AlgoFox test runner — generated file, do not edit. Run: python3 run_tests.py"""
import json, hashlib, math, sys

class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def build_list(values):
    head = None
    for v in reversed(values):
        head = ListNode(v, head)
    return head

def list_to_json(head):
    out = []
    while head is not None:
        out.append(head.val)
        head = head.next
    return out

def build_tree(values):
    if not values or values[0] is None:
        return None
    nodes = [TreeNode(v) if v is not None else None for v in values]
    kids = nodes[::-1]
    root = kids.pop()
    for node in nodes:
        if node is not None:
            if kids: node.left = kids.pop()
            if kids: node.right = kids.pop()
    return root

def tree_to_json(root):
    out, queue = [], [root]
    while queue:
        node = queue.pop(0)
        if node is None:
            out.append(None)
            continue
        out.append(node.val)
        queue.append(node.left)
        queue.append(node.right)
    while out and out[-1] is None:
        out.pop()
    return out

def decode(value, type_name):
    if type_name == "ListNode":
        return build_list(value)
    if type_name == "TreeNode":
        return build_tree(value)
    return value

def encode(value, type_name):
    if type_name == "ListNode":
        return list_to_json(value)
    if type_name == "TreeNode":
        return tree_to_json(value)
    return value

def canonical(value):
    if isinstance(value, bool) or value is None or isinstance(value, str):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, list):
        return [canonical(v) for v in value]
    if isinstance(value, dict):
        return {k: canonical(v) for k, v in value.items()}
    return value

def sort_key(value):
    return json.dumps(canonical(value), sort_keys=True)

def equals(got, expected, comparison):
    mode = comparison.get("mode", "exact")
    if mode == "unordered" and isinstance(got, list) and isinstance(expected, list):
        return sorted((canonical(v) for v in got), key=sort_key) == \
               sorted((canonical(v) for v in expected), key=sort_key)
    if mode == "float-tolerance" and isinstance(got, (int, float)) and isinstance(expected, (int, float)):
        return math.isclose(got, expected, abs_tol=comparison.get("floatTolerance", 1e-6))
    return canonical(got) == canonical(expected)

def main():
    with open("tests.json") as f:
        spec = json.load(f)
    with open(".algofox-meta.json") as f:
        meta = json.load(f)
    try:
        import solution
    except Exception as err:
        print(f"Could not import solution.py: {err}")
        sys.exit(1)
    fn = getattr(solution, spec["functionName"], None)
    if fn is None:
        print(f"solution.py must define {spec['functionName']}()")
        sys.exit(1)

    results, failures = [], []
    for case in spec["cases"]:
        args = [decode(a, p["type"]) for a, p in zip(case["args"], spec["params"])]
        try:
            got = encode(fn(*args), spec["returns"])
        except Exception as err:
            got = f"<error: {type(err).__name__}: {err}>"
        ok = not isinstance(got, str) or not got.startswith("<error:")
        ok = ok and equals(got, case["expected"], spec["comparison"])
        results.append([case["id"], "pass" if ok else "fail"])
        if ok:
            print(f"PASS  {case['id']}")
        else:
            note = f" ({case['note']})" if case.get("note") else ""
            print(f"FAIL  {case['id']}{note}")
            print(f"      expected: {json.dumps(case['expected'])}")
            print(f"      got:      {json.dumps(got) if not str(got).startswith('<error:') else got}")
            failures.append(case["id"])

    passed = len(results) - len(failures)
    print(f"\\n{passed}/{len(results)} tests passed")
    token = hashlib.sha256(
        f"{meta['problemId']}|{json.dumps(results, separators=(',', ':'))}|{meta['salt']}".encode()
    ).hexdigest()
    summary = {"problemId": meta["problemId"], "passed": passed, "failed": len(failures),
               "failures": failures, "results": results, "token": token}
    print("ALGOFOX_RESULT " + json.dumps(summary, separators=(",", ":")))

if __name__ == "__main__":
    main()
`;

export function pythonRunner(_problem: CodingProblem): string {
  return RUNNER;
}

export function pythonStarter(problem: CodingProblem): string {
  return problem.starters.python ?? "";
}

export const pythonRunCommand = "python3 run_tests.py";
export const pythonSolutionFile = "solution.py";
