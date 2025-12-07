"""
Simple SQL CLI using SQLAlchemy.

Features:
- list-schemas
- list-tables --schema <name>
- query "SELECT ..."
- repl interactive mode

Connection: set DATABASE_URL env var or provide --url argument. Example:
  export DATABASE_URL="postgresql+psycopg2://user:pass@host:5432/dbname"

This script intentionally avoids heavy dependencies and prints results in a simple table.
"""
from __future__ import annotations

import os
import argparse
import sys
import json
from typing import List

from dotenv import load_dotenv, find_dotenv

# Load .env automatically for convenience (search parents for repo .env)
load_dotenv(find_dotenv())

from sqlalchemy import create_engine, text, inspect
from sqlalchemy.engine import Engine

# Load .env automatically for convenience
load_dotenv()

# Import DbSrcConnector for agent mode
try:
    from server.dbsrc_sqlalchemy import DbSrcConnector
except Exception:
    # fallback if script run from repo root where module path differs
    from dbsrc_sqlalchemy import DbSrcConnector

# Module-level agent connector singleton
_AGENT_CONNECTOR = None


def get_engine(url: str) -> Engine:
    if not url:
        raise ValueError("No database URL provided. Use DATABASE_URL env var or --url.")
    return create_engine(url, future=True)


def list_schemas(engine: Engine) -> List[str]:
    inspector = inspect(engine)
    try:
        schemas = inspector.get_schema_names()
    except Exception:
        # Some dialects do not implement get_schema_names; try a conservative fallback
        schemas = [engine.url.database] if engine.url.database else ["default"]
    return schemas


def list_tables(engine: Engine, schema: str | None = None) -> List[str]:
    inspector = inspect(engine)
    try:
        tables = inspector.get_table_names(schema=schema)
        views = []
        if hasattr(inspector, "get_view_names"):
            try:
                views = inspector.get_view_names(schema=schema)
            except Exception:
                views = []
        # Combine tables and views with simple markers
        return [f"T: {t}" for t in tables] + [f"V: {v}" for v in views]
    except Exception as e:
        raise


def pretty_print_results(columns: List[str], rows: List[tuple]):
    if not columns:
        print("(no columns)")
        return

    # compute column widths
    col_widths = [len(col) for col in columns]
    for row in rows:
        for i, val in enumerate(row):
            s = str(val) if val is not None else "NULL"
            if len(s) > col_widths[i]:
                col_widths[i] = len(s)

    # header
    header = " | ".join(col.ljust(col_widths[i]) for i, col in enumerate(columns))
    sep = "-+-".join("-" * col_widths[i] for i in range(len(columns)))
    print(header)
    print(sep)

    for row in rows:
        line = " | ".join((str(row[i]) if row[i] is not None else "NULL").ljust(col_widths[i]) for i in range(len(columns)))
        print(line)


def run_query(engine: Engine, sql: str):
    with engine.connect() as conn:
        result = conn.execute(text(sql))
        # If the statement returns rows (SELECT), print them
        try:
            rows = result.fetchall()
            cols = result.keys()
            pretty_print_results(list(cols), rows)
            print(f"\n{len(rows)} row(s)")
        except Exception:
            # Non-select statements
            try:
                print(f"{result.rowcount} rows affected")
            except Exception:
                print("Query executed.")


def repl(engine: Engine):
    print("Entering interactive SQL REPL. Type 'exit' or 'quit' to leave.")
    while True:
        try:
            sql = input("sql> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if not sql:
            continue
        if sql.lower() in ("exit", "quit"):
            break
        try:
            run_query(engine, sql)
        except Exception as e:
            print(f"Error running query: {e}")


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Simple SQL CLI using SQLAlchemy")
    p.add_argument("--url", help="Database URL (overrides DATABASE_URL env var)")
    p.add_argument("--agent-host", help="DbSrc agent host (overrides DBSRC_AGENT_HOST)")
    p.add_argument("--agent-port", type=int, help="DbSrc agent port (overrides DBSRC_AGENT_PORT)")
    p.add_argument("--agent-auto-connect", action="store_true", help="Auto-connect to DbSrc agent when running agent commands if not connected")

    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("list-schemas", help="List available schemas")

    t_parser = sub.add_parser("list-tables", help="List tables in a schema")
    t_parser.add_argument("--schema", help="Schema name (optional)")

    q_parser = sub.add_parser("query", help="Run a single SQL query")
    q_parser.add_argument("sql", help="SQL query to run")

    sub.add_parser("repl", help="Interactive REPL to run multiple queries")

    # Agent-related commands (use DbSrcConnector)
    sub.add_parser("agent-connect", help="Connect to DbSrc agent, authenticate and bind ACCP using env vars or cli args")

    sub.add_parser("agent-access", help="Show accessible objects for configured DbSrc user")

    a_q = sub.add_parser("agent-query", help="Run SQL through the DbSrc agent")
    a_q.add_argument("sql", help="SQL query to run via agent")

    sub.add_parser("agent-disconnect", help="Disconnect ACCP and agent")

    return p


def main(argv=None):
    argv = argv or sys.argv[1:]
    parser = build_parser()
    args = parser.parse_args(argv)

    url = args.url or os.environ.get("DATABASE_URL")
    # Agent mode commands don't require DATABASE_URL
    agent_cmds = {"agent-connect", "agent-access", "agent-query", "agent-disconnect"}

    agent_host = args.agent_host or os.environ.get("DBSRC_AGENT_HOST")
    agent_port = args.agent_port or os.environ.get("DBSRC_AGENT_PORT")

    def ensure_agent_connected(auto_connect=False):
        global _AGENT_CONNECTOR
        if _AGENT_CONNECTOR and _AGENT_CONNECTOR.socket:
            return _AGENT_CONNECTOR
        if not auto_connect:
            raise RuntimeError("Agent not connected. Run 'agent-connect' first or use --agent-auto-connect")

        # build connector from args/env
        host = agent_host or os.environ.get("DBSRC_AGENT_HOST", "www.compute-mertjiandata.com")
        port = int(agent_port or os.environ.get("DBSRC_AGENT_PORT", "9000"))
        _AGENT_CONNECTOR = DbSrcConnector(host=host, port=port)

        username = os.environ.get("DBSRC_USERNAME")
        password = os.environ.get("DBSRC_USER_PASSWORD")
        accp_id = os.environ.get("DBSRC_ACCP_ID")
        client_host = os.environ.get("DBSRC_CLIENT_HOST", "127.0.0.1")

        _AGENT_CONNECTOR.connect_agent()
        _AGENT_CONNECTOR.authenticate_user(username, password)
        _AGENT_CONNECTOR.connect_accp(accp_id, username, host_ip=client_host)
        return _AGENT_CONNECTOR

    if args.cmd not in agent_cmds:
        if not url:
            print("Error: no database URL provided. Set DATABASE_URL or use --url.")
            return 2

    try:
        engine = get_engine(url) if args.cmd not in agent_cmds else None
    except Exception as e:
        print(f"Failed to create engine: {e}")
        return 3

    try:
        if args.cmd == "list-schemas":
            # If running in DB URL mode, use SQLAlchemy; otherwise try agent fallback
            if engine:
                schemas = list_schemas(engine)
                for s in schemas:
                    print(s)
            else:
                # attempt to get accessible schemas from DbSrc agent
                try:
                    c = ensure_agent_connected(auto_connect=True)
                    resp = c.show_access(os.environ.get("DBSRC_USERNAME", "ivan"))
                    data = resp.get("data")
                    if isinstance(data, str):
                        try:
                            data = json.loads(data)
                        except Exception:
                            data = None
                    if data and isinstance(data, dict):
                        schemas = data.get("schemas") or []
                        for s in schemas:
                            print(s)
                    else:
                        print(json.dumps(resp, indent=2))
                except Exception as e:
                    print(f"Agent fallback failed: {e}")

        elif args.cmd == "list-tables":
            schema = getattr(args, "schema", None)
            if engine:
                tables = list_tables(engine, schema=schema)
                for t in tables:
                    print(t)
            else:
                try:
                    c = ensure_agent_connected(auto_connect=True)
                    resp = c.show_access(os.environ.get("DBSRC_USERNAME", "ivan"))
                    data = resp.get("data")
                    if isinstance(data, str):
                        try:
                            data = json.loads(data)
                        except Exception:
                            data = None
                    if data and isinstance(data, dict):
                        tables_map = data.get("tables") or {}
                        if schema:
                            for t in tables_map.get(schema, []):
                                print(t)
                        else:
                            # print all tables with schema prefix
                            for sch, tbls in tables_map.items():
                                for t in tbls:
                                    print(f"{sch}.{t}")
                    else:
                        print(json.dumps(resp, indent=2))
                except Exception as e:
                    print(f"Agent fallback failed: {e}")

        elif args.cmd == "query":
            run_query(engine, args.sql)

        elif args.cmd == "repl":
            repl(engine)

        # ---- Agent commands ----
        elif args.cmd == "agent-connect":
            # pull values from env or CLI
            host = agent_host or os.environ.get("DBSRC_AGENT_HOST", "www.compute-mertjiandata.com")
            port = int(agent_port or os.environ.get("DBSRC_AGENT_PORT", "9000"))
            username = os.environ.get("DBSRC_USERNAME", "ivan")
            password = os.environ.get("DBSRC_USER_PASSWORD", "Rc3e4745c$4")
            accp_id = os.environ.get("DBSRC_ACCP_ID", "345")
            client_host = os.environ.get("DBSRC_CLIENT_HOST", "127.0.0.1")

            # create and persist connector
            _AGENT_CONNECTOR = DbSrcConnector(host=host, port=port)
            try:
                _AGENT_CONNECTOR.connect_agent()
                token = _AGENT_CONNECTOR.authenticate_user(username, password)
                _AGENT_CONNECTOR.connect_accp(accp_id, username, host_ip=client_host)
            except Exception as e:
                print(f"Agent connection/auth error: {e}")
                return 4

            print("Agent connected and ACCP bound. Token:", token)

        elif args.cmd == "agent-access":
            try:
                c = ensure_agent_connected(auto_connect=args.agent_auto_connect)
                resp = c.show_access(os.environ.get("DBSRC_USERNAME", "ivan"))
                print(json.dumps(resp, indent=2))
            except Exception as e:
                print(f"Error fetching access: {e}")
                return 4

        elif args.cmd == "agent-query":
            try:
                c = ensure_agent_connected(auto_connect=args.agent_auto_connect)
                resp = c.run_sql(args.sql)
                # print nicely
                print(json.dumps(resp, indent=2))
            except Exception as e:
                print(f"Error running agent query: {e}")
                return 4

        elif args.cmd == "agent-disconnect":
            try:
                if _AGENT_CONNECTOR:
                    _AGENT_CONNECTOR.disconnect()
                    _AGENT_CONNECTOR = None
                print("Agent disconnected")
            except Exception as e:
                print(f"Error disconnecting: {e}")
                return 4

    except Exception as e:
        print(f"Error: {e}")
        return 4

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
