#!/usr/bin/env node

const readline = require("readline");
const chalk = require("chalk");
const {
  executeSELECTQuery,
  executeINSERTQuery,
  executeDELETEQuery,
  executeUPDATEQuery,
} = require("./queryExecutor");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function printHelp() {
  console.log(chalk.cyan("\nSQL Query Engine CLI Usage:"));
  console.log(chalk.cyan("--------------------------------"));
  console.log(chalk.cyan("Supported SQL commands:"));
  console.log(chalk.cyan("  SELECT ... FROM ... [WHERE ...]"));
  console.log(
    chalk.cyan("  INSERT INTO table (col1, col2) VALUES (val1, val2)"),
  );
  console.log(chalk.cyan("  UPDATE table SET col1 = val1 WHERE ..."));
  console.log(chalk.cyan("  DELETE FROM table WHERE ..."));
  console.log(chalk.cyan("\nOther commands:"));
  console.log(chalk.cyan("  exit        Exit the CLI"));
  console.log(chalk.cyan("  --help      Show this help message"));
  console.log(chalk.cyan("--------------------------------\n"));
}

rl.setPrompt(chalk.green("SQL> "));
console.log(
  chalk.cyan(
    'SQL Query Engine CLI. Enter your SQL commands, or type "exit" to quit. Type --help for usage.',
  ),
);

rl.prompt();

rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (trimmed === "exit") {
    rl.close();
    return;
  }
  if (trimmed === "--help") {
    printHelp();
    rl.prompt();
    return;
  }
  try {
    if (/^\s*SELECT/i.test(trimmed)) {
      const result = await executeSELECTQuery(trimmed);
      console.log(chalk.green("Result:"), result);
    } else if (/^\s*INSERT\s+INTO/i.test(trimmed)) {
      const result = await executeINSERTQuery(trimmed);
      console.log(chalk.green(result.message));
    } else if (/^\s*DELETE\s+FROM/i.test(trimmed)) {
      const result = await executeDELETEQuery(trimmed);
      console.log(chalk.green(result.message));
    } else if (/^\s*UPDATE\s+/i.test(trimmed)) {
      const result = await executeUPDATEQuery(trimmed);
      console.log(chalk.green(result.message));
    } else {
      console.log(chalk.yellow("Unrecognized command. Type --help for usage."));
    }
  } catch (error) {
    console.error(chalk.red("Error:"), error.message);
  }
  rl.prompt();
}).on("close", () => {
  console.log(chalk.cyan("Exiting SQL CLI"));
  process.exit(0);
});
