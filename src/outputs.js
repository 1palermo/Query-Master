// Import necessary modules
const readline = require('readline');
const Table = require('cli-table3');
const {executeSELECTQuery,executeINSERTQuery,executeDELETEQuery} = require('./queryExecutor'); // Adjust path to your function

// Setup readline interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'SQL> '
});

// Function to display results in a table format
function displayTable(data) {
    if (data.length === 0) {
        console.log('No results found.');
        return;
    }

    // Extract column headers from the first row's keys
    const headers = Object.keys(data[0]);

    // Initialize the table with headers
    const table = new Table({ head: headers });

    // Populate the table with data rows
    data.forEach(row => {
        table.push(headers.map(header => row[header]));
    });

    // Print the table to the console
    console.log(table.toString());
}

// Function to execute the correct query based on the command type
async function executeQuery(query) {
    // Determine the type of SQL command
    const command = query.trim().split(' ')[0].toUpperCase();

    try {
        switch (command) {
            case 'SELECT':
                const selectResults = await executeSELECTQuery(query);
                displayTable(selectResults);
                break;
            case 'INSERT':
                await executeINSERTQuery(query);
                console.log('Insert operation successful.');
                break;
            case 'DELETE':
                await executeDELETEQuery(query);
                console.log('Delete operation successful.');
                break;
            default:
                console.log(`Unsupported command: ${command}`);
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}

// Prompt the user for input
rl.prompt();

rl.on('line', async (input) => {
    // Execute the input query
    await executeQuery(input.trim());

    // Prompt again for next input
    rl.prompt();
}).on('close', () => {
    console.log('Exiting SQL executor.');
    process.exit(0);
});