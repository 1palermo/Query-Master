const {
  parseSelectQuery,
  parseInsertQuery,
  parseDeleteQuery,
  parseUpdateQuery,
} = require("./queryParser");
const { readCSV, writeCSV } = require("./csvReader");

/**
 * Performs an INNER JOIN between two datasets based on the join condition and selected fields.
 * @param {Array} data - Main table data.
 * @param {Array} joinData - Join table data.
 * @param {Object} joinCondition - Join condition object.
 * @param {Array} fields - Fields to select.
 * @param {string} table - Main table name.
 * @returns {Array} Joined data.
 */
function performInnerJoin(data, joinData, joinCondition, fields, table) {
  return data.flatMap((mainRow) => {
    // console.log("***************************************************",mainRow);
    return joinData
      .filter((joinRow) => {
        const mainValue = mainRow[joinCondition.left.split(".")[1]];
        const joinValue = joinRow[joinCondition.right.split(".")[1]];
        return mainValue === joinValue;
      })
      .map((joinRow) => {
        return fields.reduce((acc, field) => {
          const [tableName, fieldName] = field.split(".");
          acc[field] =
            tableName === table ? mainRow[fieldName] : joinRow[fieldName];
          return acc;
        }, {});
      });
  });
}
//acc={student.name=saqib,enrollment}

/**
 * Performs a LEFT JOIN between two datasets.
 * @param {Array} data
 * @param {Array} joinData
 * @param {Object} joinCondition
 * @param {Array} fields
 * @param {string} table
 * @returns {Array}
 */
function performLeftJoin(data, joinData, joinCondition, fields, table) {
  return data.flatMap((mainRow) => {
    const matchingJoinRows = joinData.filter((joinRow) => {
      const mainValue = getValueFromRow(mainRow, joinCondition.left);
      const joinValue = getValueFromRow(joinRow, joinCondition.right);
      return mainValue === joinValue;
    });

    if (matchingJoinRows.length === 0) {
      return [createResultRow(mainRow, null, fields, table, true)];
    }

    return matchingJoinRows.map((joinRow) =>
      createResultRow(mainRow, joinRow, fields, table, true),
    );
  });
}

/**
 * Helper to get value from a row by compound field name.
 * @param {Object} row
 * @param {string} compoundFieldName
 * @returns {*}
 */
function getValueFromRow(row, compoundFieldName) {
  const [tableName, fieldName] = compoundFieldName.split(".");
  return row[`${tableName}.${fieldName}`] || row[fieldName];
}

/**
 * Performs a RIGHT JOIN between two datasets.
 * @param {Array} data
 * @param {Array} joinData
 * @param {Object} joinCondition
 * @param {Array} fields
 * @param {string} table
 * @returns {Array}
 */
function performRightJoin(data, joinData, joinCondition, fields, table) {
  // Cache the structure of a main table row (keys only)
  const mainTableRowStructure =
    data.length > 0
      ? Object.keys(data[0]).reduce((acc, key) => {
          acc[key] = null; // Set all values to null initially
          return acc;
        }, {})
      : {};

  return joinData.map((joinRow) => {
    const mainRowMatch = data.find((mainRow) => {
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

/**
 * Creates a result row for join operations.
 * @param {Object} mainRow
 * @param {Object|null} joinRow
 * @param {Array} fields
 * @param {string} table
 * @param {boolean} includeAllMainFields
 * @returns {Object}
 */
function createResultRow(
  mainRow,
  joinRow,
  fields,
  table,
  includeAllMainFields,
) {
  const resultRow = {};

  if (includeAllMainFields) {
    // Include all fields from the main table
    Object.keys(mainRow || {}).forEach((key) => {
      const prefixedKey = `${table}.${key}`;
      resultRow[prefixedKey] = mainRow ? mainRow[key] : null;
    });
  }

  // Now, add or overwrite with the fields specified in the query
  fields.forEach((field) => {
    const [tableName, fieldName] = field.includes(".")
      ? field.split(".")
      : [table, field];
    resultRow[field] =
      tableName === table && mainRow
        ? mainRow[fieldName]
        : joinRow
          ? joinRow[fieldName]
          : null;
  });

  return resultRow;
}

/**
 * Executes a SELECT SQL query.
 * @param {string} query
 * @returns {Promise<Array|Object>} Query result.
 */
async function executeSELECTQuery(query) {
  const {
    fields,
    table,
    whereClauses,
    joinType,
    joinTable,
    joinCondition,
    groupByFields,
    orderByFields,
    hasAggregateWithoutGroupBy,
    limit,
    isDistinct,
  } = parseSelectQuery(query);
  let data = await readCSV(`${table}.csv`);

  // Perform INNER JOIN if specified
  if (joinTable && joinCondition) {
    const joinData = await readCSV(`${joinTable}.csv`);
    switch (joinType.toUpperCase()) {
      case "INNER":
        data = performInnerJoin(data, joinData, joinCondition, fields, table);
        break;
      case "LEFT":
        data = performLeftJoin(data, joinData, joinCondition, fields, table);
        break;
      case "RIGHT":
        data = performRightJoin(data, joinData, joinCondition, fields, table);
        break;
      default:
        throw new Error(`Unsupported JOIN type: ${joinType}`);
    }
  }
  // Apply WHERE clause filtering after JOIN (or on the original data if no join)
  let filteredData =
    whereClauses.length > 0
      ? data.filter((row) => evaluateWhereTree(row, whereClauses))
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

    fields.forEach((field) => {
      const match = /(\w+)\((\*|\w+)\)/.exec(field);
      if (match) {
        const [, aggFunc, aggField] = match;
        switch (aggFunc.toUpperCase()) {
          case "COUNT":
            result[field] = filteredData.length;
            break;
          case "SUM":
            result[field] = filteredData.reduce(
              (acc, row) => acc + parseFloat(row[aggField]),
              0,
            );
            break;
          case "AVG":
            result[field] =
              filteredData.reduce(
                (acc, row) => acc + parseFloat(row[aggField]),
                0,
              ) / filteredData.length;
            break;
          case "MIN":
            result[field] = Math.min(
              ...filteredData.map((row) => parseFloat(row[aggField])),
            );
            break;
          case "MAX":
            result[field] = Math.max(
              ...filteredData.map((row) => parseFloat(row[aggField])),
            );
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
          if (order === "ASC") {
            if (a[fieldName] < b[fieldName]) return -1;
            if (a[fieldName] > b[fieldName]) return 1;
          } else if (order === "DESC") {
            if (a[fieldName] < b[fieldName]) return 1;
            if (a[fieldName] > b[fieldName]) return -1;
          }
        }
        return 0;
      });
    }
    if (isDistinct) {
      groupResults = [
        ...new Map(
          groupResults.map((item) => [
            fields.map((field) => item[field]).join("|"),
            item,
          ]),
        ).values(),
      ];
    }
    if (limit !== null) groupResults = groupResults.slice(0, limit);
    return groupResults;
  } else {
    // Select the specified fields
    let orderedResults = groupResults;
    if (orderByFields) {
      orderedResults = groupResults.sort((a, b) => {
        for (let { fieldName, order } of orderByFields) {
          if (a[fieldName] < b[fieldName]) return order === "ASC" ? -1 : 1;
          if (a[fieldName] > b[fieldName]) return order === "ASC" ? 1 : -1;
        }
        return 0;
      });
    }
    if (limit !== null) orderedResults = orderedResults.slice(0, limit);
    if (isDistinct) {
      orderedResults = [
        ...new Map(
          orderedResults.map((item) => [
            fields.map((field) => item[field]).join("|"),
            item,
          ]),
        ).values(),
      ];
    }
    // Select the specified fields
    return orderedResults.map(row => {
        if (fields.length === 1 && fields[0] === '*') {
            // Return the whole row for SELECT *
            return row;
        }
        const selectedRow = {};
        fields.forEach(field => {
            selectedRow[field] = row[field];
        });
        return selectedRow;
    });
  }
}

/**
 * Recursively evaluates a WHERE expression tree for a given row.
 * @param {Object} row
 * @param {Object} tree
 * @returns {boolean}
 */
function evaluateWhereTree(row, tree) {
  if (!tree) return true;
  if (tree.type === "condition") {
    return evaluateCondition(row, tree);
  } else if (tree.type === "AND") {
    return (
      evaluateWhereTree(row, tree.left) && evaluateWhereTree(row, tree.right)
    );
  } else if (tree.type === "OR") {
    return (
      evaluateWhereTree(row, tree.left) || evaluateWhereTree(row, tree.right)
    );
  }
  throw new Error("Invalid WHERE expression tree");
}

/**
 * Evaluates a single condition for WHERE clause filtering.
 * @param {Object} row
 * @param {Object} clause
 * @returns {boolean}
 */
function evaluateCondition(row, clause) {
  let { field, operator, value } = clause;

  // Check if the field exists in the row
  if (row[field] === undefined) {
    throw new Error(`Invalid field: ${field}`);
  }

  if (clause.operator === "LIKE") {
    // Transform SQL LIKE pattern to JavaScript RegExp pattern
    const regexPattern = "^" + clause.value.replace(/%/g, ".*") + "$";
    return new RegExp(regexPattern, "i").test(row[clause.field]);
  }
  // Parse row value and condition value based on their actual types
  const rowValue = parseValue(row[field]);
  let conditionValue = parseValue(value);

  switch (operator) {
    case "=":
      return rowValue === conditionValue;
    case "!=":
      return rowValue !== conditionValue;
    case ">":
      return rowValue > conditionValue;
    case "<":
      return rowValue < conditionValue;
    case ">=":
      return rowValue >= conditionValue;
    case "<=":
      return rowValue <= conditionValue;
    default:
      throw new Error(`Unsupported operator: ${operator}`);
  }
}

/**
 * Parses a value to its appropriate type (number or string).
 * @param {string} value
 * @returns {*}
 */
function parseValue(value) {
  // Return null or undefined as is
  if (value === null || value === undefined) {
    return value;
  }

  // If the value is a string enclosed in single or double quotes, remove them
  if (
    typeof value === "string" &&
    ((value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"')))
  ) {
    value = value.substring(1, value.length - 1);
  }

  // Check if value is a number
  if (!isNaN(value) && value.trim() !== "") {
    return Number(value);
  }
  // Assume value is a string if not a number
  return value;
}

/**
 * Applies GROUP BY logic to data with aggregate functions.
 * @param {Array} data
 * @param {Array} groupByFields
 * @param {Array} aggregateFunctions
 * @returns {Array}
 */
function applyGroupBy(data, groupByFields, aggregateFunctions) {
  const groupResults = {};

  data.forEach((row) => {
    // Generate a key for the group
    const groupKey = groupByFields.map((field) => row[field]).join("-");

    // Initialize group in results if it doesn't exist
    if (!groupResults[groupKey]) {
      groupResults[groupKey] = { count: 0, sums: {}, mins: {}, maxes: {} };
      groupByFields.forEach(
        (field) => (groupResults[groupKey][field] = row[field]),
      );
    }

    // Aggregate calculations
    groupResults[groupKey].count += 1;
    aggregateFunctions.forEach((func) => {
      const match = /(\w+)\((\w+)\)/.exec(func);
      if (match) {
        const [, aggFunc, aggField] = match;
        const value = parseFloat(row[aggField]);

        switch (aggFunc.toUpperCase()) {
          case "SUM":
            groupResults[groupKey].sums[aggField] =
              (groupResults[groupKey].sums[aggField] || 0) + value;
            break;
          case "MIN":
            groupResults[groupKey].mins[aggField] = Math.min(
              groupResults[groupKey].mins[aggField] || value,
              value,
            );
            break;
          case "MAX":
            groupResults[groupKey].maxes[aggField] = Math.max(
              groupResults[groupKey].maxes[aggField] || value,
              value,
            );
            break;
          // Additional aggregate functions can be added here
        }
      }
    });
  });

  // Convert grouped results into an array format
  return Object.values(groupResults).map((group) => {
    // Construct the final grouped object based on required fields
    const finalGroup = {};
    groupByFields.forEach((field) => (finalGroup[field] = group[field]));
    aggregateFunctions.forEach((func) => {
      const match = /(\w+)\((\*|\w+)\)/.exec(func);
      if (match) {
        const [, aggFunc, aggField] = match;
        switch (aggFunc.toUpperCase()) {
          case "SUM":
            finalGroup[func] = group.sums[aggField];
            break;
          case "MIN":
            finalGroup[func] = group.mins[aggField];
            break;
          case "MAX":
            finalGroup[func] = group.maxes[aggField];
            break;
          case "COUNT":
            finalGroup[func] = group.count;
            break;
          // Additional aggregate functions can be handled here
        }
      }
    });

    return finalGroup;
  });
}

/**
 * Executes an INSERT SQL query.
 * @param {string} query
 * @returns {Promise<Object>} Result message.
 */
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

/**
 * Executes a DELETE SQL query.
 * @param {string} query
 * @returns {Promise<Object>} Result message.
 */
async function executeDELETEQuery(query) {
  const { table, whereClauses } = parseDeleteQuery(query);
  let data = await readCSV(`${table}.csv`);
  if (whereClauses.length > 0) {
    data = data.filter((row) => !evaluateWhereTree(row, whereClauses));
    // data =data.filter(row => !whereClauses.every(clause => evaluateCondition(row,clause)));
  } else {
    data = [];
  }

  await writeCSV(`${table}.csv`, data);
  return { message: "Rows deleted successfully." };
}

/**
 * Executes an UPDATE SQL query.
 * @param {string} query
 * @returns {Promise<Object>} Result message.
 */
async function executeUPDATEQuery(query) {
  const { table, setClauses, whereClauses } = parseUpdateQuery(query);
  let data = await readCSV(`${table}.csv`);
  let updatedCount = 0;
  data = data.map((row) => {
    const match = evaluateWhereTree(row, whereClauses);
    if (match) {
      updatedCount++;
      setClauses.forEach(({ column, value }) => {
        row[column] = value;
      });
    }
    return row;
  });
  await writeCSV(`${table}.csv`, data);
  return { message: `${updatedCount} row(s) updated successfully.` };
}

module.exports = {
  executeSELECTQuery,
  executeINSERTQuery,
  executeDELETEQuery,
  executeUPDATEQuery,
};
