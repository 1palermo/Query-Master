
function parseSelectQuery(query) {
    query = query.trim();

    const limitRegex = /\sLIMIT\s(\d+)/i;
    const limitMatch = query.match(limitRegex);

    let limit = null;
    if (limitMatch) {
        limit = parseInt(limitMatch[1]);
    }
    query=query.replace(limitRegex,'');

    const orderByRegex = /\sORDER BY\s(.+)/i;
    const orderByMatch = query.match(orderByRegex);
    let orderByFields = null;
    if (orderByMatch) {
        orderByFields = orderByMatch[1].split(',').map(field => {
            const [fieldName, order] = field.trim().split(/\s+/);
            return { fieldName, order: order ? order.toUpperCase() : 'ASC' };
        });
    }
    query=query.replace(orderByRegex,'');
    
    const groupBySplit = query.split(/\sGROUP BY\s/i);
    const queryWithoutGroupBy = groupBySplit[0];
    let groupByFields = groupBySplit.length > 1 ? groupBySplit[1].trim().split(',').map(field => field.trim()) : null;


    const whereSplit = queryWithoutGroupBy.split(/\sWHERE\s/i);
    const queryWithoutWhere = whereSplit[0];
    const whereClause = whereSplit.length > 1 ? whereSplit[1].trim() : null;

    const joinSplit = queryWithoutWhere.split(/\s(INNER|LEFT|RIGHT) JOIN\s/i);
    let selectPart = joinSplit[0].trim();

    let isDistinct=false;
    if (selectPart.toUpperCase().includes('SELECT DISTINCT')) {
        isDistinct = true;
        selectPart = selectPart.replace('SELECT DISTINCT', 'SELECT');
    }

    const selectRegex = /^SELECT\s(.+?)\sFROM\s(.+)/i;
    const selectMatch = selectPart.match(selectRegex);
    
    if (!selectMatch) {
        throw new Error("Error executing query: Query parsing error: Invalid SELECT format");
    }
    const [, fields, table] = selectMatch;

    const joinInfo = parseJoinClause(queryWithoutWhere);
    const { joinType, joinTable, joinCondition } = joinInfo;

    let whereClauses = [];
    if (whereClause) {
        whereClauses = parseWhereClause(whereClause);
    }

    const aggregateFunctionRegex = /(\bCOUNT\b|\bAVG\b|\bSUM\b|\bMIN\b|\bMAX\b)\s*\(\s*(\*|\w+)\s*\)/i;
    const hasAggregateWithoutGroupBy = aggregateFunctionRegex.test(query) && !groupByFields;
    // console.log(orderByFields);
    return {
        fields: fields.split(',').map(field => field.trim()),
        table: table.trim(),
        whereClauses,
        joinType,
        joinTable,
        joinCondition,
        groupByFields,
        orderByFields, 
        hasAggregateWithoutGroupBy,
        limit,
        isDistinct
    };
}


function parseWhereClause(whereString) {
    
    const conditionRegex = /(.*?)(=|!=|>|<|>=|<=)(.*)/;
    return whereString.split(/ AND | OR /i).map(conditionString => {
        if (conditionString.includes(' LIKE ')) {
            const [field, pattern] = conditionString.split(/\sLIKE\s/i);
            return { field: field.trim(), operator: 'LIKE', value: pattern.trim().replace(/^'(.*)'$/, '$1') };
        }
        const match = conditionString.match(conditionRegex);
        if (match) {
            const [, field, operator, value] = match;
            return { field: field.trim(), operator, value: value.trim() };
        }
        throw new Error('Invalid WHERE clause format');
    });
}
function parseJoinClause(query) {
    const joinRegex = /\s(INNER|LEFT|RIGHT) JOIN\s(.+?)\sON\s([\w.]+)\s*=\s*([\w.]+)/i;
    const joinMatch = query.match(joinRegex);

    if (joinMatch) {
        return {
            joinType: joinMatch[1].trim(),
            joinTable: joinMatch[2].trim(),
            joinCondition: {
                left: joinMatch[3].trim(),
                right: joinMatch[4].trim()
            }
        };
    }

    return {
        joinType: null,
        joinTable: null,
        joinCondition: null
    };
}
function parseInsertQuery(query) {
    //
    const insertRegex = /INSERT INTO (\w+)\s\((.+)\)\sVALUES\s\((.+)\)/i;
    const match = query.match(insertRegex);

    if (!match) {
        throw new Error("Invalid INSERT INTO syntax.");
    }

    const [, table, columns, values] = match;
    return {
        type: 'INSERT',
        table: table.trim(),
        columns: columns.split(',').map(column => column.trim()),
        values: values.split(',').map(value => value.trim())
    };
}
function parseDeleteQuery(query){
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
        type: 'DELETE',
        table: table.trim(),
        whereClauses
    };
}
// module.exports = parseQuery;
module.exports = { parseSelectQuery, parseJoinClause ,parseInsertQuery, parseDeleteQuery};