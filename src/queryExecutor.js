const { parseSelectQuery,parseInsertQuery,parseDeleteQuery } = require('./queryParser');
const { readCSV, writeCSV } = require('./csvReader');

function performInnerJoin(data, joinData, joinCondition, fields, table) {
    
    return data.flatMap(mainRow => {
        // console.log("***************************************************",mainRow);
        return joinData 
            .filter(joinRow => {
                const mainValue = mainRow[joinCondition.left.split('.')[1]];
                const joinValue = joinRow[joinCondition.right.split('.')[1]];
                return mainValue === joinValue;
            })
            .map(joinRow => {
                return fields.reduce((acc, field) => {
                    const [tableName, fieldName] = field.split('.');
                    acc[field] = tableName === table ? mainRow[fieldName] : joinRow[fieldName];
                    return acc;
                }, {});
            });
    });
}
//acc={student.name=saqib,enrollment}

function performLeftJoin(data, joinData, joinCondition, fields, table) {
    return data.flatMap(mainRow => {
        const matchingJoinRows = joinData.filter(joinRow => {
            const mainValue = getValueFromRow(mainRow, joinCondition.left);
            const joinValue = getValueFromRow(joinRow, joinCondition.right);
            return mainValue === joinValue;
        });

        if (matchingJoinRows.length === 0) {
            return [createResultRow(mainRow, null, fields, table, true)];
        }

        return matchingJoinRows.map(joinRow => createResultRow(mainRow, joinRow, fields, table, true));
    });
}

function getValueFromRow(row, compoundFieldName) {
    const [tableName, fieldName] = compoundFieldName.split('.');
    return row[`${tableName}.${fieldName}`] || row[fieldName];
}

function performRightJoin(data, joinData, joinCondition, fields, table) {
    // Cache the structure of a main table row (keys only)
    const mainTableRowStructure = data.length > 0 ? Object.keys(data[0]).reduce((acc, key) => {
        acc[key] = null; // Set all values to null initially
        return acc;
    }, {}) : {};

    return joinData.map(joinRow => {
        const mainRowMatch = data.find(mainRow => {
            const mainValue = getValueFromRow(mainRow, joinCondition.left);
            const joinValue = getValueFromRow(joinRow, joinCondition.right);
            return mainValue === joinValue;
        });

        // Use the cached structure if no match is found
        const mainRowToUse = mainRowMatch || mainTableRowStructure;

        // Include all necessary fields from the 'student' table
        return createResultRow(mainRowToUse, joinRow, fields, table, true);
    });
}

function createResultRow(mainRow, joinRow, fields, table, includeAllMainFields) {
    const resultRow = {};

    if (includeAllMainFields) {
        // Include all fields from the main table
        Object.keys(mainRow || {}).forEach(key => {
            const prefixedKey = `${table}.${key}`;
            resultRow[prefixedKey] = mainRow ? mainRow[key] : null;
        });
    }

    // Now, add or overwrite with the fields specified in the query
    fields.forEach(field => {
        const [tableName, fieldName] = field.includes('.') ? field.split('.') : [table, field];
        resultRow[field] = tableName === table && mainRow ? mainRow[fieldName] : joinRow ? joinRow[fieldName] : null;
    });

    return resultRow;
}

async function executeSELECTQuery(query) {
    const { fields, table, whereClauses, joinType, joinTable, joinCondition, groupByFields,orderByFields, hasAggregateWithoutGroupBy , limit, isDistinct} = parseSelectQuery(query);
    let data = await readCSV(`${table}.csv`);

    // Perform INNER JOIN if specified
    if (joinTable && joinCondition) {
        const joinData = await readCSV(`${joinTable}.csv`);
        switch (joinType.toUpperCase()) {
            case 'INNER':
                data = performInnerJoin(data, joinData, joinCondition, fields, table);
                break;
            case 'LEFT':
                data = performLeftJoin(data, joinData, joinCondition, fields, table);
                break;
            case 'RIGHT':
                data = performRightJoin(data, joinData, joinCondition, fields, table);
                break;
            default:
                throw new Error(`Unsupported JOIN type: ${joinType}`);
        }
    }
    // Apply WHERE clause filtering after JOIN (or on the original data if no join)
    let filteredData = whereClauses.length > 0
        ? data.filter(row => whereClauses.every(clause => evaluateCondition(row, clause)))
        : data; 
//map filter reduce
//[{1,Muaz},{2,saqib}]
//
    let groupResults = filteredData;
    // console.log({ hasAggregateWithoutGroupBy });
    if (hasAggregateWithoutGroupBy) {
        // Special handling for queries like 'SELECT COUNT(*) FROM table'
        const result = {};

        // console.log({ filteredData })

        fields.forEach(field => {
            const match = /(\w+)\((\*|\w+)\)/.exec(field);
            if (match) {
                const [, aggFunc, aggField] = match;
                switch (aggFunc.toUpperCase()) {
                    case 'COUNT':
                        result[field] = filteredData.length;
                        break;
                    case 'SUM':
                        result[field] = filteredData.reduce((acc, row) => acc + parseFloat(row[aggField]), 0);
                        break;
                    case 'AVG':
                        result[field] = filteredData.reduce((acc, row) => acc + parseFloat(row[aggField]), 0) / filteredData.length;
                        break;
                    case 'MIN':
                        result[field] = Math.min(...filteredData.map(row => parseFloat(row[aggField])));
                        break;
                    case 'MAX':
                        result[field] = Math.max(...filteredData.map(row => parseFloat(row[aggField])));
                        break;
                    // Additional aggregate functions can be handled here
                }
            }
        });
//spred operator
        return [result];
        // Add more cases here if needed for other aggregates
    } else if (groupByFields) {
        groupResults = applyGroupBy(filteredData, groupByFields, fields);
        let orderedResults = groupResults;
        if (orderByFields) {
            orderedResults = groupResults.sort((a, b) => {
                for (let { fieldName, order } of orderByFields) {
                    if (order === 'ASC') {
                        if (a[fieldName] < b[fieldName]) return -1;
                        if (a[fieldName] > b[fieldName]) return 1;
                    } else if (order === 'DESC') {
                        if (a[fieldName] < b[fieldName]) return 1;
                        if (a[fieldName] > b[fieldName]) return -1;
                    }
                }
                return 0;
            });
        }
        if (isDistinct) {
            groupResults = [...new Map(groupResults.map(item => [fields.map(field => item[field]).join('|'), item])).values()];
        }
        if(limit!==null)
            groupResults = groupResults.slice(0, limit);
        return groupResults;
        
    } else {
        // Select the specified fields
        let orderedResults = groupResults;
        if (orderByFields) {
            orderedResults = groupResults.sort((a, b) => {
                for (let { fieldName, order } of orderByFields) {
                    if (a[fieldName] < b[fieldName]) return order === 'ASC' ? -1 : 1;
                    if (a[fieldName] > b[fieldName]) return order === 'ASC' ? 1 : -1;
                }
                return 0;
            });
        }
        if(limit!==null)
            orderedResults = orderedResults.slice(0, limit);
        if (isDistinct) {
            orderedResults = [...new Map(orderedResults.map(item => [fields.map(field => item[field]).join('|'), item])).values()];
        }
        // Select the specified fields
        return orderedResults.map(row => {
            const selectedRow = {};
            fields.forEach(field => {
                // Assuming 'field' is just the column name without table prefix
                selectedRow[field] = row[field];
            });
            return selectedRow;
        });
    }
}

function evaluateCondition(row, clause) {
    let { field, operator, value } = clause;

    // Check if the field exists in the row
    if (row[field] === undefined) {
        throw new Error(`Invalid field: ${field}`);
    }
    
    if (clause.operator === 'LIKE') {
        // Transform SQL LIKE pattern to JavaScript RegExp pattern
        const regexPattern = '^' + clause.value.replace(/%/g, '.*') + '$';
        return new RegExp(regexPattern, 'i').test(row[clause.field]);
    }
    // Parse row value and condition value based on their actual types
    const rowValue = parseValue(row[field]);
    let conditionValue = parseValue(value);

    switch (operator) {
        case '=': return rowValue === conditionValue;
        case '!=': return rowValue !== conditionValue;
        case '>': return rowValue > conditionValue;
        case '<': return rowValue < conditionValue;
        case '>=': return rowValue >= conditionValue;
        case '<=': return rowValue <= conditionValue;
        default: throw new Error(`Unsupported operator: ${operator}`);
    }
}

// Helper function to parse value based on its apparent type
function parseValue(value) {

    // Return null or undefined as is
    if (value === null || value === undefined) {
        return value;
    }

    // If the value is a string enclosed in single or double quotes, remove them
    if (typeof value === 'string' && ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"')))) {
        value = value.substring(1, value.length - 1);
    }

    // Check if value is a number
    if (!isNaN(value) && value.trim() !== '') {
        return Number(value);
    }
    // Assume value is a string if not a number
    return value;
}

function applyGroupBy(data, groupByFields, aggregateFunctions) {
    const groupResults = {};

    data.forEach(row => {
        // Generate a key for the group
        const groupKey = groupByFields.map(field => row[field]).join('-');

        // Initialize group in results if it doesn't exist
        if (!groupResults[groupKey]) {
            groupResults[groupKey] = { count: 0, sums: {}, mins: {}, maxes: {} };
            groupByFields.forEach(field => groupResults[groupKey][field] = row[field]);
        }

        // Aggregate calculations
        groupResults[groupKey].count += 1;
        aggregateFunctions.forEach(func => {
            const match = /(\w+)\((\w+)\)/.exec(func);
            if (match) {
                const [, aggFunc, aggField] = match;
                const value = parseFloat(row[aggField]);

                switch (aggFunc.toUpperCase()) {
                    case 'SUM':
                        groupResults[groupKey].sums[aggField] = (groupResults[groupKey].sums[aggField] || 0) + value;
                        break;
                    case 'MIN':
                        groupResults[groupKey].mins[aggField] = Math.min(groupResults[groupKey].mins[aggField] || value, value);
                        break;
                    case 'MAX':
                        groupResults[groupKey].maxes[aggField] = Math.max(groupResults[groupKey].maxes[aggField] || value, value);
                        break;
                    // Additional aggregate functions can be added here
                }
            }
        });
    });

    // Convert grouped results into an array format
    return Object.values(groupResults).map(group => {
        // Construct the final grouped object based on required fields
        const finalGroup = {};
        groupByFields.forEach(field => finalGroup[field] = group[field]);
        aggregateFunctions.forEach(func => {
            const match = /(\w+)\((\*|\w+)\)/.exec(func);
            if (match) {
                const [, aggFunc, aggField] = match;
                switch (aggFunc.toUpperCase()) {
                    case 'SUM':
                        finalGroup[func] = group.sums[aggField];
                        break;
                    case 'MIN':
                        finalGroup[func] = group.mins[aggField];
                        break;
                    case 'MAX':
                        finalGroup[func] = group.maxes[aggField];
                        break;
                    case 'COUNT':
                        finalGroup[func] = group.count;
                        break;
                    // Additional aggregate functions can be handled here
                }
            }
        });

        return finalGroup;
    });
}

async function executeINSERTQuery(query) {
    console.log(parseInsertQuery(query));
    const { table, columns, values } = parseInsertQuery(query);
    const data = await readCSV(`${table}.csv`);

    // Create a new row object
    const newRow = {};
    columns.forEach((column, index) => {
        // Remove single quotes from the values
        let value = values[index];
        if (value.startsWith("'") && value.endsWith("'")) {
            value = value.substring(1, value.length - 1);
        }
        newRow[column] = value;
    });

    // Add the new row to the data
    data.push(newRow);

    // Save the updated data back to the CSV file
    await writeCSV(`${table}.csv`, data); // Implement writeCSV function

    return { message: "Row inserted successfully." };
}

async function executeDELETEQuery(query){
    const {table,whereClauses} = parseDeleteQuery(query);
    let data= await readCSV(`${table}.csv`);
    if(whereClauses.length > 0){
        data = data.filter(row => !whereClauses.every(clause => evaluateCondition(row, clause)));
        // data =data.filter(row => !whereClauses.every(clause => evaluateCondition(row,clause)));
    }
    else{
        data = [];
    }

    await writeCSV(`${table}.csv`,data);
    return { message: "Rows deleted successfully." };

}
module.exports = {executeSELECTQuery,executeINSERTQuery, executeDELETEQuery};
