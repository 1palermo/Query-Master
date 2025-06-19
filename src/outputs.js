// Import necessary modules
const readline = require("readline");
const Table = require("cli-table3");
const chalk = require("chalk");
const {
  executeSELECTQuery,
  executeINSERTQuery,
  executeDELETEQuery,
  executeUPDATEQuery,
} = require("./queryExecutor"); // Adjust path to your function

// Setup readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: chalk.green("SQL> "),
});

// Print help instructions to the user
function printHelp() {
  console.log(chalk.cyan("\nSQL Query Engine Interactive Shell Usage:"));
  console.log(chalk.cyan("--------------------------------"));
  console.log(chalk.cyan("Supported SQL commands:"));
  console.log(chalk.cyan("  SELECT ... FROM ... [WHERE ...]"));
  console.log(
    chalk.cyan("  INSERT INTO table (col1, col2) VALUES (val1, val2)"),
  );
  console.log(chalk.cyan("  UPDATE table SET col1 = val1 WHERE ..."));
  console.log(chalk.cyan("  DELETE FROM table WHERE ..."));
  console.log(chalk.cyan("\nOther commands:"));
  console.log(chalk.cyan("  exit        Exit the shell"));
  console.log(chalk.cyan("  --help      Show this help message"));
  console.log(chalk.cyan("--------------------------------\n"));
}

// Function to display results in a table format using cli-table3
function displayTable(data) {
  if (!data || data.length === 0) {
    console.log(chalk.yellow("No results found."));
    return;
  }
  // Handle SELECT * returning [{ '*': undefined }, ...]
  if (
    Object.keys(data[0]).length === 1 &&
    Object.keys(data[0])[0] === '*' &&
    data.every(row => row['*'] === undefined)
  ) {
    console.log(chalk.red('Query returned no valid columns. Did you mean to use SELECT *? Check your CSV schema.'));
    return;
  }
  // Extract column headers from the first row's keys
  const headers = Object.keys(data[0]);
  // Initialize the table with headers
  const table = new Table({ head: headers });
  // Populate the table with data rows
  data.forEach((row) => {
    table.push(headers.map((header) => row[header]));
  });
  // Print the table to the console
  console.log(table.toString());
}

// Main function to execute the correct query based on the command type
async function executeQuery(query) {
  // Determine the type of SQL command
  const command = query.trim().split(" ")[0].toUpperCase();
  try {
    switch (command) {
      case "SELECT":
        // Execute SELECT and display results in a table
        const selectResults = await executeSELECTQuery(query);
        displayTable(selectResults);
        break;
      case "INSERT":
        // Execute INSERT and show success message
        await executeINSERTQuery(query);
        console.log(chalk.green("Insert operation successful."));
        break;
      case "DELETE":
        // Execute DELETE and show success message
        await executeDELETEQuery(query);
        console.log(chalk.green("Delete operation successful."));
        break;
      case "UPDATE":
        // Execute UPDATE and show success message
        await executeUPDATEQuery(query);
        console.log(chalk.green("Update operation successful."));
        break;
      default:
        // Unrecognized command
        console.log(
          chalk.yellow("Unrecognized command. Type --help for usage."),
        );
    }
  } catch (error) {
    // Print errors in red
    console.error(chalk.red("Error:"), error.message);
  }
}

console.log(
  chalk.cyan(
    'SQL Query Engine Interactive Shell. Enter your SQL commands, or type "exit" to quit. Type --help for usage.',
  ),
);
rl.prompt();

// Main input loop for the interactive shell
rl.on("line", async (input) => {
  const trimmed = input.trim();
  if (trimmed === "exit") {
    rl.close();
    return;
  }
  if (trimmed === "--help") {
    printHelp();
    rl.prompt();
    return;
  }
  // Execute the input query and prompt again
  await executeQuery(trimmed);
  rl.prompt();
}).on("close", () => {
  console.log(chalk.cyan("Exiting SQL executor."));
  process.exit(0);
});
