import 'source-map-support/register'

import { APIGatewayProxyEvent } from 'aws-lambda'
import * as AWS from 'aws-sdk'
import * as uuid from 'uuid'

import { TodoItem } from '../models/TodoItem'

const docClient = new AWS.DynamoDB.DocumentClient()

const todosTable = process.env.TODOS_TABLE
const indexName = process.env.USERID_CREATEDAT_INDEX

export async function getTodos(userId: string): Promise<TodoItem[]> {
  console.log(`Retrieving all todos for user ${userId}`)

  const result = await docClient.query({
    TableName: todosTable,
    IndexName: indexName,
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': userId
    }
  }).promise()

  const items = result.Items

  console.log(`Retrieved ${items.length} todos`)

  return items as TodoItem[]
}
