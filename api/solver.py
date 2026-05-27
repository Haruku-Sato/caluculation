import re
from typing import Optional

from sympy import Symbol, symbols, Eq, solve
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

    # TODO (growth feature): Non-linear equation support.
    # To add: detect polynomial degree > 1 and route to sympy.nonlinsolve()
    # with a numeric fallback via sympy.nsolve().

    raw = solve(sympy_eqs, solve_for, dict=True)

    if not raw:
        return {
            "result": "no_solution",
            "solutions": {},
            "free_variables": [],
            "note": "No solution exists for the given system.",
        }

    solution_dict: dict = raw[0] if isinstance(raw, list) else raw

    solutions = {str(k): str(v) for k, v in solution_dict.items()}

    # Variables that appear free in any solution value
    free_syms: set[Symbol] = set()
    for val in solution_dict.values():
        free_syms.update(val.free_symbols)

    # Variables in solve_for that sympy didn't constrain at all
    solved_syms = set(solution_dict.keys())
    unconstrained = [s for s in solve_for if s not in solved_syms]
    free_syms.update(unconstrained)

    free_variables = sorted(str(s) for s in free_syms)

    if free_variables:
        result_type = "parametric"
        note = (
            f"Free variable(s): {', '.join(free_variables)}. "
            "The solution is expressed in terms of them."
        )
    else:
        result_type = "unique"
        note = None

    response: dict = {
        "result": result_type,
        "solutions": solutions,
        "free_variables": free_variables,
    }
    if note:
        response["note"] = note
    return response
