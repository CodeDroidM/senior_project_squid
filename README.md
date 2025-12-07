# SQL CLI (`sqd_cli.py`)

Simple command-line utility to connect to a database using SQLAlchemy and:

- list available schemas
- list tables within a schema
- run SQL queries (single-run or interactive REPL)

Usage

1. Install dependencies (preferably in a virtualenv):

```bash
pip install -r requirements.txt
```

2. Set a DATABASE_URL environment variable (or pass --url):

```bash
export DATABASE_URL="postgresql+psycopg2://user:pass@host:5432/dbname"
```

3. Examples:

```bash
python sqd_cli.py list-schemas
python sqd_cli.py list-tables --schema public
python sqd_cli.py query "SELECT id, name FROM some_table LIMIT 5"
python sqd_cli.py repl
```

Notes & assumptions

- This tool connects directly to the database via SQLAlchemy. The existing `dbsrc_sqlalchemy_example.py` in the repository shows an alternative socket-based agent approach; this CLI uses direct DB connections for convenience.
- If your project requires routing queries through a separate agent/service, we can adapt the CLI to call that instead.

Safety

- Use with care on production databases. The REPL will execute any SQL you type.

Next steps

- Add auth/connection presets, and a small web UI later to turn this into a minimal SaaS front-end.
