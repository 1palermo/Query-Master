# SQL Query Parser & Engine

A Node.js-based SQL engine that can parse and execute SQL queries (SELECT, INSERT, UPDATE, DELETE) directly on CSV files. Supports WHERE clauses with AND/OR/grouping, JOINs, aggregation, and more—all from the command line or an interactive shell.

![screenshot](https://github.com/user-attachments/assets/c7d0501e-4403-436b-8595-e8a7b1d3009e)

## Features

- Run SQL queries (SELECT, INSERT, UPDATE, DELETE) on CSV files
- WHERE clause with AND, OR, and parentheses (grouping)
- JOIN support (INNER, LEFT, RIGHT)
- Aggregation: COUNT, SUM, AVG, MIN, MAX
- ORDER BY, GROUP BY, LIMIT, DISTINCT
- Interactive shell and CLI with colored output and help

## Installation

1. Clone this repository:
   ```sh
   git clone <repo-url>
   cd SQL-Query-Parser
   ```
2. Install dependencies:
   ```sh
   cd SQL-Query-Parser
   npm install
   ```

## Usage

### CLI

Run the CLI:

```sh
node src/cli.js
```

- Type SQL commands or `exit` to quit.
- Type `--help` for usage instructions.

### Interactive Shell

Run the interactive shell:

```sh
node src/outputs.js
```

- Type SQL commands or `exit` to quit.
- Type `--help` for usage instructions.

### Supported SQL Syntax

- `SELECT fields FROM table [WHERE ...] [ORDER BY ...] [GROUP BY ...] [LIMIT ...] [DISTINCT]`
- `INSERT INTO table (col1, col2) VALUES (val1, val2)`
- `UPDATE table SET col1 = val1 WHERE ...`
- `DELETE FROM table WHERE ...`
- WHERE supports AND, OR, parentheses, =, !=, >, <, >=, <=, LIKE
- JOINs: INNER, LEFT, RIGHT
- Aggregates: COUNT, SUM, AVG, MIN, MAX

### Examples

```sql
SELECT name, age FROM student WHERE (age > 18 AND grade = 'A') OR (name = 'John')
INSERT INTO student (id, name, age) VALUES (3, 'Alice', 22)
UPDATE student SET grade = 'B' WHERE score > 80
DELETE FROM student WHERE age < 18 OR grade = 'F'
```

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

1. Fork the repo and create your branch.
2. Make your changes and add tests if needed.
3. Submit a pull request.

## License

MIT
