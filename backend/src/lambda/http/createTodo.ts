import 'source-map-support/register'

import { APIGatewayProxyEvent, APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda'
import * as AWS  from 'aws-sdk'
import * as uuid from 'uuid'

import { CreateTodoRequest } from '../../requests/CreateTodoRequest'
import { getUserId } from '../utils'

const docClient = new AWS.DynamoDB.DocumentClient()

const todosTable = process.env.TODOS_TABLE

export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Processing event: ', event)

  const newTodo: CreateTodoRequest = JSON.parse(event.body)

  const userId = getUserId(event)
  const todoId = uuid.v4()
  const timestamp = new Date().toISOString()

  const newItem = {
    userId,
    createdAt: timestamp,
    todoId,
    done: false,
    attachmentUrl: null,
    ...newTodo
  }

  await docClient.put({
    TableName: todosTable,
    Item: newItem,
  }).promise()

  return {
    statusCode: 201,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true
    },
    body: JSON.stringify({
      item: newItem
    })
  }
}
