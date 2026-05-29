import math
import re
from typing import Optional

from sympy import Symbol, symbols, Eq, solve, latex, lambdify
from sympy.parsing.sympy_parser import (
    parse_expr,
    standard_transformations,
    implicit_multiplication_application,
    convert_xor,
)

TRANSFORMATIONS = standard_transformations + (
    implicit_multiplication_application,
    convert_xor,
)

# Known math constants/functions — not treated as user variables
_RESERVED = {
    "sin", "cos", "tan", "asin", "acos", "atan", "atan2",
    "exp", "log", "sqrt", "pi", "E", "I",
    "Abs", "re", "im", "conjugate",
}

_X_RANGE = list(range(-10, 11))


def _extract_symbol_names(equations: list[str]) -> list[str]:
    joined = " ".join(equations)
    candidates = re.findall(r'[a-zA-Z_][a-zA-Z0-9_]*', joined)
    seen: set[str] = set()
    result: list[str] = []
    for c in candidates:
        if c not in _RESERVED and c not in seen:
            seen.add(c)
            result.append(c)
    return result


def _build_local_dict(names: list[str]) -> dict:
    if not names:
        return {}
    syms = symbols(" ".join(names))
    if isinstance(syms, Symbol):
        syms = (syms,)
    return dict(zip(names, syms))


def _parse_single_equation(eq_str: str, local_dict: dict) -> Eq:
    parts = eq_str.split("=")
    if len(parts) != 2:
        raise ValueError(
            f"Equation must contain exactly one '=': {eq_str!r}"
        )
    lhs = parse_expr(parts[0].strip(), local_dict=local_dict, transformations=TRANSFORMATIONS)
    rhs = parse_expr(parts[1].strip(), local_dict=local_dict, transformations=TRANSFORMATIONS)
    return Eq(lhs, rhs)


def _build_steps(
    sympy_eqs: list,
    solutions_list: list[dict[str, str]],
    result_type: str,
) -> list[dict[str, str]]:
    steps: list[dict[str, str]] = []

    # Step 1: original equations
    if len(sympy_eqs) == 1:
        eq_latex = latex(sympy_eqs[0])
    else:
        inner = r" \\ ".join(latex(eq) for eq in sympy_eqs)
        eq_latex = r"\begin{cases}" + inner + r"\end{cases}"
    steps.append({"label": "元の方程式", "latex": eq_latex})

    # Step 2: standard form (lhs − rhs = 0) — skip if identical or if any eq
    # simplified to a boolean (e.g. BooleanFalse for contradictions)
    std_eqs = [
        Eq(eq.lhs - eq.rhs, 0) for eq in sympy_eqs
        if hasattr(eq, "lhs")
    ]
    if std_eqs:
        if len(std_eqs) == 1:
            std_latex = latex(std_eqs[0])
        else:
            inner = r" \\ ".join(latex(eq) for eq in std_eqs)
            std_latex = r"\begin{cases}" + inner + r"\end{cases}"
        if std_latex != eq_latex:
            steps.append({"label": "整理（左辺＝0）", "latex": std_latex})

    # Step 3: solution
    if result_type == "no_solution":
        steps.append({"label": "解なし", "latex": r"\text{解なし}"})
    elif result_type == "multiple" and solutions_list:
        sol_parts = [
            ",\\;" .join(f"{k} = {v}" for k, v in sol.items())
            for sol in solutions_list
        ]
        sol_latex = r"\quad\text{または}\quad".join(sol_parts)
        steps.append({"label": "解", "latex": sol_latex})
    elif solutions_list:
        sol = solutions_list[0]
        sol_latex = ",\\quad ".join(f"{k} = {v}" for k, v in sol.items())
        steps.append({"label": "解", "latex": sol_latex})

    return steps


def _build_graph_data(
    sympy_eqs: list,
    equation_strs: list[str],
    raw: list[dict],
    local_dict: dict,
) -> dict | None:
    x_sym = local_dict.get("x")
    y_sym = local_dict.get("y")

    if x_sym is None:
        return None

    lines: list[dict] = []

    for eq, eq_str in zip(sympy_eqs, equation_strs):
        if y_sym is None:
            continue
        try:
            y_exprs = solve(eq, y_sym)
        except Exception:
            continue
        for j, expr in enumerate(y_exprs):
            try:
                f = lambdify(x_sym, expr, modules="math")
            except Exception:
                continue
            y_vals: list[float | None] = []
            for xv in _X_RANGE:
                try:
                    yv = float(f(xv))
                    if not math.isfinite(yv) or abs(yv) > 1e6:
                        y_vals.append(None)
                    else:
                        y_vals.append(round(yv, 4))
                except Exception:
                    y_vals.append(None)
            name = eq_str if len(y_exprs) == 1 else f"{eq_str} ({j + 1})"
            lines.append({"name": name, "x_vals": list(_X_RANGE), "y_vals": y_vals})

    if not lines:
        return None

    solution_points: list[dict] = []
    for sol in raw:
        try:
            x_val = sol.get(x_sym)
            y_val = sol.get(y_sym) if y_sym else None
            if x_val is None or y_val is None:
                continue
            xf, yf = float(x_val), float(y_val)
            if math.isfinite(xf) and math.isfinite(yf):
                solution_points.append({
                    "x": round(xf, 4),
                    "y": round(yf, 4),
                    "label": f"({xf:.4g}, {yf:.4g})",
                })
        except Exception:
            pass

    return {"lines": lines, "solution_points": solution_points}


def solve_equations(
    equations: list[str],
    variable_names: Optional[list[str]] = None,
) -> dict:
    if not equations:
        raise ValueError("At least one equation is required.")

    all_symbol_names = _extract_symbol_names(equations)
    local_dict = _build_local_dict(all_symbol_names)

    if variable_names is not None:
        unknown = [v for v in variable_names if v not in local_dict]
        if unknown:
            raise ValueError(f"Variables not found in equations: {unknown}")
        solve_for = [local_dict[v] for v in variable_names]
    else:
        solve_for = list(local_dict.values())

    sympy_eqs = [_parse_single_equation(eq, local_dict) for eq in equations]

    raw = solve(sympy_eqs, solve_for, dict=True)

    if not raw:
        steps = _build_steps(sympy_eqs, [], "no_solution")
        return {
            "result": "no_solution",
            "solutions": [],
            "free_variables": [],
            "note": None,
            "steps": steps,
            "graph_data": None,
        }

    solutions_list: list[dict[str, str]] = [
        {str(k): latex(v) for k, v in sol_dict.items()}
        for sol_dict in raw
    ]

    first = raw[0]
    free_syms: set[Symbol] = set()
    for val in first.values():
        free_syms.update(val.free_symbols)
    solved_syms = set(first.keys())
    unconstrained = [s for s in solve_for if s not in solved_syms]
    free_syms.update(unconstrained)
    free_variables = sorted(str(s) for s in free_syms)

    if len(raw) > 1:
        result_type = "multiple"
    elif free_variables:
        result_type = "parametric"
    else:
        result_type = "unique"

    steps = _build_steps(sympy_eqs, solutions_list, result_type)
    graph_data = _build_graph_data(sympy_eqs, equations, raw, local_dict)

    return {
        "result": result_type,
        "solutions": solutions_list,
        "free_variables": free_variables,
        "note": None,
        "steps": steps,
        "graph_data": graph_data,
    }
