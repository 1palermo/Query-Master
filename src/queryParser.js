/**
 * Parses a SELECT SQL query string into its components.
 * @param {string} query - The SQL SELECT query string.
 * @returns {Object} Parsed query components.
 */
function parseSelectQuery(query) {
  query = query.trim();

  const limitRegex = /\sLIMIT\s(\d+)/i;
  const limitMatch = query.match(limitRegex);

  let limit = null;
  if (limitMatch) {
    limit = parseInt(limitMatch[1]);
  }
  query = query.replace(limitRegex, "");

  const orderByRegex = /\sORDER BY\s(.+)/i;
  const orderByMatch = query.match(orderByRegex);
  let orderByFields = null;
  if (orderByMatch) {
    orderByFields = orderByMatch[1].split(",").map((field) => {
      const [fieldName, order] = field.trim().split(/\s+/);
      return { fieldName, order: order ? order.toUpperCase() : "ASC" };
    });
  }
  query = query.replace(orderByRegex, "");

  const groupBySplit = query.split(/\sGROUP BY\s/i);
  const queryWithoutGroupBy = groupBySplit[0];
  let groupByFields =
    groupBySplit.length > 1
      ? groupBySplit[1]
          .trim()
          .split(",")
          .map((field) => field.trim())
      : null;

  const whereSplit = queryWithoutGroupBy.split(/\sWHERE\s/i);
  const queryWithoutWhere = whereSplit[0];
  const whereClause = whereSplit.length > 1 ? whereSplit[1].trim() : null;

  const joinSplit = queryWithoutWhere.split(/\s(INNER|LEFT|RIGHT) JOIN\s/i);
  let selectPart = joinSplit[0].trim();

  let isDistinct = false;
  if (selectPart.toUpperCase().includes("SELECT DISTINCT")) {
    isDistinct = true;
    selectPart = selectPart.replace("SELECT DISTINCT", "SELECT");
  }

  const selectRegex = /^SELECT\s(.+?)\sFROM\s(.+)/i;
  const selectMatch = selectPart.match(selectRegex);

  if (!selectMatch) {
    throw new Error(
      "Error executing query: Query parsing error: Invalid SELECT format",
    );
  }
  const [, fields, table] = selectMatch;

  const joinInfo = parseJoinClause(queryWithoutWhere);
  const { joinType, joinTable, joinCondition } = joinInfo;

  let whereClauses = [];
  if (whereClause) {
    whereClauses = parseWhereClause(whereClause);
  }

  const aggregateFunctionRegex =
    /(\bCOUNT\b|\bAVG\b|\bSUM\b|\bMIN\b|\bMAX\b)\s*\(\s*(\*|\w+)\s*\)/i;
  const hasAggregateWithoutGroupBy =
    aggregateFunctionRegex.test(query) && !groupByFields;
  // console.log(orderByFields);
  return {
    fields: fields.split(",").map((field) => field.trim()),
    table: table.trim(),
    whereClauses,
    joinType,
    joinTable,
    joinCondition,
    groupByFields,
    orderByFields,
    hasAggregateWithoutGroupBy,
    limit,
    isDistinct,
  };
}

/**
 * Parses the WHERE clause into an expression tree supporting AND, OR, and parentheses.
 * @param {string} whereString - The WHERE clause string.
 * @returns {Object} Expression tree.
 */
function parseWhereClause(whereString) {
  // Tokenize the string (supports parentheses, AND, OR, and conditions)
  const tokens = [];
  const regex =
    /\(|\)|\bAND\b|\bOR\b|[^\s()]+(?:\s*(?:=|!=|>|<|>=|<=|LIKE)\s*[^\s()]+)?/gi;
  let match;
  while ((match = regex.exec(whereString)) !== null) {
    tokens.push(match[0].trim());
  }
  // Recursive descent parser
  function parseExpression(index = 0) {
    let left, operator;
    function parseCondition(token) {
      if (token.includes(" LIKE ")) {
        const [field, pattern] = token.split(/\sLIKE\s/i);
        return {
          type: "condition",
          field: field.trim(),
          operator: "LIKE",
          value: pattern.trim().replace(/^'(.*)'$/, "$1"),
        };
      }
      const condMatch = token.match(/(.*?)(=|!=|>|<|>=|<=)(.*)/);
      if (condMatch) {
        const [, field, op, value] = condMatch;
        return {
          type: "condition",
          field: field.trim(),
          operator: op,
          value: value.trim(),
        };
      }
      throw new Error("Invalid WHERE clause format");
    }
    let result = null;
    while (index < tokens.length) {
      let token = tokens[index];
      if (token === "(") {
        const [expr, nextIdx] = parseExpression(index + 1);
        if (!result) result = expr;
        else result = { type: operator, left: result, right: expr };
        index = nextIdx;
      } else if (token === ")") {
        return [result, index + 1];
      } else if (
        token.toUpperCase() === "AND" ||
        token.toUpperCase() === "OR"
      ) {
        operator = token.toUpperCase();
        index++;
      } else {
        const cond = parseCondition(token);
        if (!result) result = cond;
        else result = { type: operator, left: result, right: cond };
        index++;
      }
    }
    return [result, index];
  }
  const [tree] = parseExpression();
  return tree;
}

/**
 * Parses JOIN clause from a query string.
 * @param {string} query - The SQL query string.
 * @returns {Object} Join information (type, table, condition).
 */
function parseJoinClause(query) {
  const joinRegex =
    /\s(INNER|LEFT|RIGHT) JOIN\s(.+?)\sON\s([\w.]+)\s*=\s*([\w.]+)/i;
  const joinMatch = query.match(joinRegex);

  if (joinMatch) {
    return {
      joinType: joinMatch[1].trim(),
      joinTable: joinMatch[2].trim(),
      joinCondition: {
        left: joinMatch[3].trim(),
        right: joinMatch[4].trim(),
      },
    };
  }

  return {
    joinType: null,
    joinTable: null,
    joinCondition: null,
  };
}

/**
 * Parses an INSERT SQL query string.
 * @param {string} query - The SQL INSERT query string.
 * @returns {Object} Parsed insert query components.
 */
function parseInsertQuery(query) {
  //
  const insertRegex = /INSERT INTO (\w+)\s\((.+)\)\sVALUES\s\((.+)\)/i;
  const match = query.match(insertRegex);

  if (!match) {
    throw new Error("Invalid INSERT INTO syntax.");
  }

  const [, table, columns, values] = match;
  return {
    type: "INSERT",
    table: table.trim(),
    columns: columns.split(",").map((column) => column.trim()),
    values: values.split(",").map((value) => value.trim()),
  };
}

/**
 * Parses a DELETE SQL query string.
 * @param {string} query - The SQL DELETE query string.
 * @returns {Object} Parsed delete query components.
 */
function parseDeleteQuery(query) {
  //DELETE FROM courses WHERE course_id = '2'
  const deleteRegex = /DELETE FROM (\w+)( WHERE (.*))?/i;
  const match = query.match(deleteRegex);
  if (!match) {
    throw new Error("Invalid DELETE syntax.");
  }

  const [, table, , whereString] = match;
  let whereClauses = [];
  if (whereString) {
    whereClauses = parseWhereClause(whereString);
  }

  return {
    type: "DELETE",
    table: table.trim(),
    whereClauses,
  };
}

/**
 * Parses an UPDATE SQL query string.
 * @param {string} query - The SQL UPDATE query string.
 * @returns {Object} Parsed update query components.
 */
function parseUpdateQuery(query) {
  // Example: UPDATE table SET col1 = 'val1', col2 = 'val2' WHERE col3 = 'val3'
  const updateRegex = /UPDATE\s+(\w+)\s+SET\s+(.+?)(?:\s+WHERE\s+(.+))?$/i;
  const match = query.match(updateRegex);
  if (!match) {
    throw new Error("Invalid UPDATE syntax.");
  }
  const [, table, setString, whereString] = match;
  // Parse set clauses
  const setClauses = setString.split(",").map((pair) => {
    const [column, value] = pair.split("=").map((s) => s.trim());
    return { column, value: value.replace(/^'(.*)'$/, "$1") };
  });
  // Parse where clauses if present
  let whereClauses = [];
  if (whereString) {
    whereClauses = parseWhereClause(whereString);
  }
  return {
    type: "UPDATE",
    table: table.trim(),
    setClauses,
    whereClauses,
  };
}

// Export all main parsing functions for use in executors and CLI
module.exports = {
  parseSelectQuery,
  parseJoinClause,
  parseInsertQuery,
  parseDeleteQuery,
  parseUpdateQuery,
};
